data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "ec2_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "ninar_runtime" {
  statement {
    sid       = "AudioObjects"
    effect    = "Allow"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.audio.arn}/*"]
  }

  statement {
    sid       = "AudioBucketMetadata"
    effect    = "Allow"
    actions   = ["s3:GetBucketLocation", "s3:ListBucket"]
    resources = [aws_s3_bucket.audio.arn]
  }

  statement {
    sid       = "AnalysisQueue"
    effect    = "Allow"
    actions   = ["sqs:GetQueueAttributes", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:SendMessage", "sqs:ChangeMessageVisibility"]
    resources = [aws_sqs_queue.analyses.arn, aws_sqs_queue.analyses_dlq.arn]
  }
}

resource "aws_iam_role" "ec2" {
  name               = "${var.project_name}-${var.environment}-ec2-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json
}

resource "aws_iam_role_policy" "ninar_runtime" {
  name   = "${var.project_name}-${var.environment}-runtime"
  role   = aws_iam_role.ec2.id
  policy = data.aws_iam_policy_document.ninar_runtime.json
}

resource "aws_iam_instance_profile" "ec2" {
  name = "${var.project_name}-${var.environment}-profile"
  role = aws_iam_role.ec2.name
}

resource "aws_security_group" "k3s" {
  name        = "${var.project_name}-${var.environment}-k3s"
  description = "Public web entrypoint and restricted administration for Ninar k3s"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP for Traefik redirect or local testing"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS for Traefik"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH from administrator only"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_admin_cidr]
  }

  ingress {
    description = "k3s API from administrator only"
    from_port   = 6443
    to_port     = 6443
    protocol    = "tcp"
    cidr_blocks = [var.allowed_admin_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_s3_bucket" "audio" {
  bucket = "${var.project_name}-${var.environment}-audio-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "audio" {
  bucket                  = aws_s3_bucket.audio.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "audio" {
  bucket = aws_s3_bucket.audio.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "audio" {
  bucket = aws_s3_bucket.audio.id
  rule {
    id     = "expire-audio"
    status = "Enabled"
    filter { prefix = "analyses/" }
    expiration { days = 7 }
  }
}

resource "aws_s3_bucket_cors_configuration" "audio" {
  bucket = aws_s3_bucket.audio.id
  cors_rule {
    allowed_methods = ["PUT"]
    allowed_origins = compact([
      "http://localhost:3000",
      var.domain_name != "" ? "https://${var.domain_name}" : "",
    ])
    allowed_headers = ["Content-Type", "x-amz-*", "*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 300
  }
}

resource "aws_sqs_queue" "analyses_dlq" {
  name                      = "${var.project_name}-${var.environment}-analyses-dlq"
  message_retention_seconds = 1209600
}

resource "aws_sqs_queue" "analyses" {
  name                       = "${var.project_name}-${var.environment}-analyses"
  visibility_timeout_seconds = 900
  receive_wait_time_seconds  = 20
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.analyses_dlq.arn
    maxReceiveCount     = 5
  })
}

resource "aws_ecr_repository" "services" {
  for_each             = toset(["web", "api", "worker", "inference"])
  name                 = "${var.project_name}/${each.key}"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration { scan_on_push = true }
}

resource "aws_instance" "k3s" {
  ami                         = var.ami_id
  instance_type               = var.instance_type
  subnet_id                   = var.subnet_id
  vpc_security_group_ids      = [aws_security_group.k3s.id]
  iam_instance_profile        = aws_iam_instance_profile.ec2.name
  key_name                    = var.key_name
  associate_public_ip_address = true

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  user_data = templatefile("${path.module}/user-data.sh.tftpl", {
    aws_region = var.aws_region
  })

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 40
    encrypted             = true
    delete_on_termination = true
  }
}
