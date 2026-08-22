# Handoff

**Branch:** `arena/01a028f5-refund`  
**Issues:** #1 audit/approval contract, #2 AliExpress UA buyer guidance  
**SHA:** see latest commit on the branch after push

## Completed

- Stage 0–2 foundation through SQL snapshot, boot, JWKS, jobs, runbook, Shopify draft.
- Outbox + post-submit lifecycle + erasure: `docs/iterations/2026-08-22-outbox-retention-lifecycle.md`.
- File ownership: `packages/domain/**`, `packages/persist/**`, `apps/api/**`, `apps/worker/**`, `db/**`, `docs/**`, `infra/terraform/**`.

## Not done

- Live `pg.Pool` opens only when `openPostgres`/`bindPgPool` succeeds against a secret-injected DSN.
- Temporal Cloud client is not bound.
- Object store is a port (`MemoryObjectStore` / `UnboundObjectStore`); no cloud SDK.
- No Shopify connector.
- No AliExpress Open Platform client (`aliexpress-ua` stays `draft`).

## How to resume

1. `npm ci && npm run ci`
2. Apply `db/migrations/*.sql` to a disposable Postgres 16 if you need trigger tests.
3. Read `docs/research/2026-08-22-identity-rbac-audit.md` before touching auth.
4. Keep `ALIEXPRESS_UA_SOURCE.status === "draft"`.
5. Do not add marketplace HTTP clients until Source Registry `approved` and merchant OAuth exist.

## Validation / rollback

CI scripts in `package.json`. SQL rollback in `db/ROLLBACK.md`.
