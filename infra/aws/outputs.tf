output "ec2_public_ip" { value = aws_instance.k3s.public_ip }
output "audio_bucket" { value = aws_s3_bucket.audio.bucket }
output "analyses_queue_url" { value = aws_sqs_queue.analyses.url }
output "analyses_dlq_url" { value = aws_sqs_queue.analyses_dlq.url }
output "ecr_repository_urls" { value = { for name, repo in aws_ecr_repository.services : name => repo.repository_url } }
output "iam_instance_profile" { value = aws_iam_instance_profile.ec2.name }
