# Terraform skeleton

Declarative data plane for stage 0. **Do not apply from an agent laptop with long-lived keys.** Use CI OIDC and environment approvals.

Creates:

- Encrypted Postgres 16 (password in Secrets Manager via `manage_master_user_password`).
- Artifact bucket for fixtures/evidence URIs.
- Versioned audit bucket with Object Lock governance retention.

State belongs in a remote backend, not in this repository.

Rollback: `terraform destroy` only on disposable `dev`. Production uses PITR + bucket versioning, not destroy.
