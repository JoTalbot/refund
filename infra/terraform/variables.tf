variable "aws_region" {
  type        = string
  description = "AWS region for managed data plane."
  default     = "eu-central-1"
}

variable "environment" {
  type        = string
  description = "Environment name (dev, staging, prod)."
  default     = "dev"
}

variable "database_secret_id" {
  type        = string
  description = "Secrets Manager id that holds DATABASE_URL. Never the URL itself."
  default     = "refund/dev/database-url"
}

variable "oidc_audience" {
  type        = string
  description = "Expected JWT audience for the API."
  default     = "refund-api"
}
