# Iteration 2026-08-22 — managed Postgres secret id + Temporal port

## Goal

Resolve the database DSN from a secret id (never commit the URL) and expose a Temporal-shaped workflow runtime. Marketplace connectors stay disabled.

## Done

- `EnvSecretResolver` / `resolveDatabaseUrl` + password redaction.
- `PgSqlQuery` adapter; runtime uses injected SQL as `postgres` or falls back to PGlite.
- Unbound resolved DSN fails closed instead of printing the URL.
- `LeaseWorkflowRuntime` vs `TemporalCloudRuntime` (refuses to pretend it is connected).
- `@refund/worker` describes lease/temporal mode and an empty connector list.

## Validation

`npm run ci`

## Risks

- No live `pg` pool is opened in this environment; production must inject the pool after resolving the secret.
- Temporal Cloud is a port, not a running cluster.

## Rollback

`git revert`. No new SQL migration.

## Next

- Bind `pg.Pool` from the resolved secret in a real environment.
- Deploy Temporal worker when the address secret exists.
- Still no AliExpress/Shopify connector.
