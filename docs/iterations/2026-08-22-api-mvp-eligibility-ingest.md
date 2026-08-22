# Iteration 2026-08-22 — API MVP, eligibility, merchant export

## Goal

Implement architecture §7 in-process and the first compliant catalog path (merchant self-export). No marketplace connector.

## Done

- Eligibility engine on versioned policy snapshots (`eligible | ineligible | needs_review`).
- Merchant JSON export parser + fixture (`merchant-export@1.0.0`).
- Durable job lease helpers (acquire / heartbeat / takeover).
- OIDC claim mapper + explicit dev-header actor (disabled in production unless `ALLOW_DEV_ACTOR=1`).
- In-memory API for sources, import-runs, products, orders, cases, attestations, approvals, submit, audit.
- Migration `0003_jobs_and_import_runs.sql`.

## Validation

`npm run ci`

## Risks

- API state is in-memory: a vanished process loses cases. Production must use Postgres (schema already in `db/migrations`).
- Dev actor headers are a test/dev seam only.
- `manual_guidance_only` is the only provider action allowed against a non-approved source.

## Rollback

`git revert` this commit. SQL: drop `import_runs` and `job_leases` (`db/ROLLBACK.md`).

## Next

- Postgres repositories behind the same `Platform` methods.
- Verified OIDC middleware (JWKS).
- Temporal worker that uses `job_leases` instead of the in-memory map.
- Still no AliExpress/Shopify connector until a source is `approved` with a written basis.
