variable "aws_region" {
  type        = string
  description = "AWS region used by the homologation environment."
  default     = "us-east-1"
}

variable "environment" {
  type    = string
  default = "hml"
}

variable "project_name" {
  type    = string
  default = "ninar"
}

variable "vpc_id" {
  type        = string
  description = "VPC where the EC2 instance will run (use the default VPC for the study environment)."
}

variable "subnet_id" {
  type        = string
  description = "Public subnet with an Internet Gateway and a route to 0.0.0.0/0."
}

variable "ami_id" {
  type        = string
  description = "Ubuntu 24.04 LTS AMI compatible with the selected region."
}

variable "instance_type" {
  type    = string
  default = "t3.medium"
}

variable "key_name" {
  type        = string
  description = "Existing EC2 key pair name."
  default     = null
  nullable    = true
}

variable "allowed_admin_cidr" {
  type        = string
  description = "Your public IP in CIDR notation for SSH and the k3s API, e.g. 203.0.113.10/32."
}

variable "domain_name" {
  type        = string
  description = "DNS host used by the Ingress. Leave empty when using the Elastic IP directly."
  default     = ""
}
