# Iteration 2026-08-22 — boot on PGlite, remote JWKS, durable worker

## Goal

Start the API with a hydrated SQL snapshot, verify tokens via JWKS URL, and run import behind a resumable job lease. No marketplace connector.

## Done

- `createRuntime()` applies migrations, loads the snapshot, and is used by `startServer()`.
- `remoteJwksVerifier` / `oidcFromEnv()` (`OIDC_JWKS_URL`).
- `runImportWorkflow` resumes an expired lease on another worker id.

## Validation

`npm run ci`

## Risks

- Default PGlite is in-process: a killed API still loses data unless a managed Postgres is wired later.
- Remote JWKS depends on network at token-verify time.
- This is not Temporal Cloud; it is the same lease contract Temporal would wrap.

## Rollback

`git revert`. No production schema change beyond existing migrations.

## Next

- Managed Postgres DSN in the runtime (secret id, not a URL in Git).
- Temporal worker process.
- Still no AliExpress/Shopify connector.
