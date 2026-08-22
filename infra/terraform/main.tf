locals {
  name = "refund-${var.environment}"
}

resource "aws_s3_bucket" "artifacts" {
  bucket = "${local.name}-artifacts"
}

resource "aws_s3_bucket" "audit" {
  bucket              = "${local.name}-audit"
  object_lock_enabled = true
}

resource "aws_s3_bucket_versioning" "audit" {
  bucket = aws_s3_bucket.audit.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_object_lock_configuration" "audit" {
  bucket = aws_s3_bucket.audit.id
  rule {
    default_retention {
      mode = "GOVERNANCE"
      days = 365
    }
  }

  depends_on = [aws_s3_bucket_versioning.audit]
}

resource "aws_db_instance" "primary" {
  identifier                 = "${local.name}-pg"
  engine                     = "postgres"
  engine_version             = "16"
  instance_class             = "db.t4g.medium"
  allocated_storage          = 50
  max_allocated_storage      = 200
  username                   = "refund_admin"
  manage_master_user_password = true
  db_name                    = "refund"
  skip_final_snapshot        = var.environment != "prod"
  backup_retention_period    = 14
  deletion_protection        = var.environment == "prod"
  storage_encrypted          = true
  copy_tags_to_snapshot      = true
}

output "artifact_bucket" {
  value = aws_s3_bucket.artifacts.bucket
}

output "audit_bucket" {
  value = aws_s3_bucket.audit.bucket
}

output "database_secret_id" {
  value       = var.database_secret_id
  description = "Reference only. Resolve in the workload identity."
}

output "oidc_audience" {
  value = var.oidc_audience
}
