variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "aws_endpoint" {
  description = "Service endpoint. Floci/LocalStack locally; set to \"\" for real AWS."
  type        = string
  default     = "http://localhost:4566"
}

variable "aws_access_key" {
  description = "Access key (dummy for the local emulator)."
  type        = string
  default     = "test"
}

variable "aws_secret_key" {
  description = "Secret key (dummy for the local emulator)."
  type        = string
  default     = "test"
  sensitive   = true
}

variable "project" {
  description = "Resource name prefix."
  type        = string
  default     = "enterprise-demo"
}

variable "environment" {
  description = "Deployment environment (local | staging | prod)."
  type        = string
  default     = "local"
}

variable "outbox_queue_name" {
  description = "Name of the Transactional Outbox SQS queue (matches floci-init and the SqsService default)."
  type        = string
  default     = "domain-events"
}

variable "log_retention_days" {
  description = "CloudWatch log retention."
  type        = number
  default     = 14
}

locals {
  tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
