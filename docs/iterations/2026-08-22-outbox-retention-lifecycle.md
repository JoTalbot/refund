# Iteration 2026-08-22 — outbox, retention, post-submit lifecycle

## Goal

Close the Git-side gaps after stages 0–2: transactional outbox (table already existed), post-submit case reconciliation, PII erasure with legal hold, structured logs, source rate limits, and an object-store port. No marketplace connector.

## Done

- Domain: outbox, retention/erasure, evidence validation, rate limiter, structured logs, provider-action reconcile.
- SQL `0006_outbox_retention.sql`: outbox delivery columns, `legal_hold`, `erased_at`.
- API: transition, evidence GET, legal hold, erasure, outbox list/publish, action reconcile, source suspend, 429.
- Console: after-submit actions and a working «прогнать весь сценарий».

## Out of scope (intentional)

- Shopify Admin API client, AliExpress Open Platform, scraping, login/cookies.
- Binding a live S3 SDK or Temporal Cloud client.

## Validation

`npm run ci`

## Rollback

`git revert`. SQL: `db/ROLLBACK.md` §0006.
