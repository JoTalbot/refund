terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend is selected per environment. Do not store state on an agent disk.
  # backend "s3" {}
}

provider "aws" {
  region = var.aws_region
}
