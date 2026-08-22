# Terraform skeleton

Declarative data plane for stage 0. **Do not apply from an agent laptop with long-lived keys.** Use CI OIDC and environment approvals.

Creates:

- Encrypted Postgres 16 (password in Secrets Manager via `manage_master_user_password`).
- Artifact bucket for fixtures/evidence URIs.
- Versioned audit bucket with Object Lock governance retention.

State belongs in a remote backend, not in this repository.

Also creates a GitHub Actions OIDC role (`github_oidc.tf`) that may read only the database secret id prefix and write artifact/audit buckets.

Apply from CI with short-lived OIDC, not from an agent laptop.

Rollback: `terraform destroy` only on disposable `dev`. Production uses PITR + bucket versioning, not destroy.

Runbook: [`docs/RUNBOOK_DEPLOY_RU.md`](../../docs/RUNBOOK_DEPLOY_RU.md).
