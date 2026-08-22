# Iteration 2026-08-22 — stage 0 audit contract + UA buyer guide

## Goal

Close GitHub issues #1 and #2 on a green `npm run ci` without any provider connector.

## Done

- Domain package `@refund/domain`: RBAC, hash-chained audit appender, approval gate, case state machine, source registry.
- SQL `0001_foundation` + `0002_audit_append_only` with rollback notes.
- Research notes for identity/audit and AliExpress UA.
- Manual-first Russian buyer guide; source `aliexpress-ua` stays `draft`.
- CI: lint, types, tests, secret scan, link validation, SQL contract, no-connector check (`npm run ci`). Workflow template: `docs/ci/github-actions-ci.yml`.
- Terraform skeleton for managed Postgres, object storage, secret references.

## Validation

`npm run ci`

## Risks

- AliExpress promotional URLs return 404/maintenance; guide tells operators to trust the in-account order page.
- Hash algorithm lives in TypeScript; SQL trigger checks linkage, not the same canonical JSON. Changing `computeEventHash` requires a versioned dual-write plan.
- No live Postgres in CI yet; triggers are reviewed statically.

## Rollback

Revert this git commit. SQL rollback: `db/ROLLBACK.md`. No production data exists.

## Next

- Wire OIDC + real Postgres repository adapters.
- Durable Temporal workflow skeleton.
- Do **not** approve `aliexpress-ua` or add an Open Platform client until legal review.
