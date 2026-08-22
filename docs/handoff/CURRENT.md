# Handoff

**Branch:** `arena/01a028f5-refund`  
**Issues:** #1 audit/approval contract, #2 AliExpress UA buyer guidance  
**SHA:** see latest commit on the branch after push

## Completed

- Stage 0 foundation code and docs listed in `docs/iterations/2026-08-22-stage0-audit-and-ua-guide.md`.
- File ownership for this change: `packages/domain/**`, `db/**`, `scripts/**`, `apps/api/**`, `docs/**`, `.github/**`, `infra/terraform/**`, root JS/TS config.

## Not done

- No OIDC integration.
- No Temporal workers.
- No Shopify connector.
- No AliExpress Open Platform client (explicitly forbidden until source is `approved`).

## How to resume

1. `npm ci && npm run ci`
2. Apply `db/migrations/*.sql` to a disposable Postgres 16 if you need trigger tests.
3. Read `docs/research/2026-08-22-identity-rbac-audit.md` before touching auth.
4. Keep `ALIEXPRESS_UA_SOURCE.status === "draft"`.

## Validation / rollback

CI scripts in `package.json`. SQL rollback in `db/ROLLBACK.md`.
