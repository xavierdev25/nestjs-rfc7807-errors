# AWS provider wired to the Floci emulator (drop-in for LocalStack). The same
# configuration targets real AWS by overriding `aws_endpoint` to "" and using
# real credentials — the resource definitions are identical.

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region     = var.aws_region
  access_key = var.aws_access_key
  secret_key = var.aws_secret_key

  # Local emulator conveniences (no-ops against real AWS).
  s3_use_path_style           = true
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    sqs            = var.aws_endpoint
    sns            = var.aws_endpoint
    secretsmanager = var.aws_endpoint
    logs           = var.aws_endpoint
    cloudwatch     = var.aws_endpoint
    apigateway     = var.aws_endpoint
    elbv2          = var.aws_endpoint
  }
}
