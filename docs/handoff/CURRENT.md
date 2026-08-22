# Handoff

**Branch:** `arena/01a028f5-refund`  
**Issues:** #1 audit/approval contract, #2 AliExpress UA buyer guidance  
**SHA:** see latest commit on the branch after push

## Completed

- Stage 0 foundation: `docs/iterations/2026-08-22-stage0-audit-and-ua-guide.md`.
- API MVP + eligibility + merchant-export ingest: `docs/iterations/2026-08-22-api-mvp-eligibility-ingest.md`.
- File ownership: `packages/domain/**`, `apps/api/**`, `db/**`, `fixtures/ingest/**`, `docs/**`.

## Not done

- No verified OIDC/JWKS middleware (claim mapper exists).
- No Temporal runtime (lease helpers exist).
- No Shopify connector.
- No AliExpress Open Platform client (`aliexpress-ua` stays `draft`).

## How to resume

1. `npm ci && npm run ci`
2. Apply `db/migrations/*.sql` to a disposable Postgres 16 if you need trigger tests.
3. Read `docs/research/2026-08-22-identity-rbac-audit.md` before touching auth.
4. Keep `ALIEXPRESS_UA_SOURCE.status === "draft"`.

## Validation / rollback

CI scripts in `package.json`. SQL rollback in `db/ROLLBACK.md`.
