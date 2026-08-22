# Iteration 2026-08-22 — SQL snapshot of cases and orders

## Goal

A vanished API process must be able to reload sources, orders, cases, approvals and provider actions from Postgres. No marketplace connector.

## Done

- Migration `0004_order_lines_and_policy.sql`.
- `Platform.exportSnapshot` / `fromSnapshot`.
- `SqlPlatformStore` save/load against the relational schema.
- POST handlers persist the snapshot when a store is configured.

## Validation

`npm run ci`

## Risks

- Snapshot replace of `order_lines` is delete+insert (safe for MVP, not a high-write ledger).
- Audit rows are insert-only (`ON CONFLICT DO NOTHING`).
- Live `npm run dev:api` still defaults to memory unless a store is wired at boot.

## Rollback

`git revert`. SQL: `db/ROLLBACK.md` §0004.

## Next

- Boot the API on PGlite/Postgres by default in non-ephemeral environments.
- Remote JWKS.
- Temporal worker.
