# Iteration 2026-08-22 — OIDC JWT + SQL audit/jobs

## Goal

Verify access tokens (iss/aud/exp/role) and persist audit events and job leases through the existing Postgres schema. No marketplace connector.

## Done

- `actorFromAccessToken` (`jose` RS256) and Bearer support in the API.
- `SqlAuditStore` / `SqlJobStore` / `runDurableStep` against PGlite.
- Expired lease takeover for import-style workers.

## Validation

`npm run ci`

## Risks

- API case state is still in-memory; only audit/jobs have a SQL adapter.
- PGlite cannot exercise `RAISE` triggers; use real Postgres 16 for that.
- Dev actor headers remain available when `NODE_ENV !== production`.

## Rollback

`git revert` this commit. No production DB writes.

## Next

- Persist cases/orders/sources through the same SQL port.
- JWKS URL fetch (not only injected keys).
- Temporal worker wrapping `runDurableStep`.
