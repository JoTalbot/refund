# Iteration 2026-08-22 — console + SQL trigger proof

## Goal

Give operators a same-origin console and prove the Postgres migrations (append-only audit, approval gate) against an embedded engine. Still no marketplace connector.

## Done

- Operator console at `/` (dev actor headers, AliExpress checklist tab).
- List endpoints: `/v1/me`, orders, cases, import-runs, approval-requests.
- `@refund/persist` applies `db/migrations` in PGlite and asserts two-person `CHECK`. PGlite currently aborts on `RAISE` inside triggers (`setTempRet0`); append-only trigger behaviour is for real Postgres 16.
- `docker-compose.yml` for a disposable Postgres 16.

## Validation

`npm run ci`

## Risks

- Console uses in-memory API state: restart loses cases. Production remains managed Postgres.
- PGlite skips `pgcrypto`; real Postgres should still apply the extension.
- Dev role switcher is not an identity system.

## Rollback

`git revert` this commit. No production schema applied from this change.

## Next

- `pg` repository implementing `Platform` methods.
- JWKS-verified OIDC.
- Temporal worker on `job_leases`.
