# Research: identity, RBAC and append-only audit

**Date:** 2026-08-22 · **Skill:** research-intelligence · **Issue:** #1

This note compares current options for tenant-aware identity, authorization and immutable audit. No provider connector is selected or implemented.

## Identity (AuthN)

| Option | Fit | Risks | Decision |
|---|---|---|---|
| External OIDC (Auth0, Clerk, Cognito, Keycloak) | Short-lived tokens, MFA/step-up, no passwords in our DB | Vendor lock-in; must map `sub` → tenant actor | **Recommended for MVP** |
| Custom password table | Fast to sketch | Secret storage, reset flows, MFA from scratch | Rejected |
| Mutual TLS service identity only | Good for workers | Does not cover human console users | Use **in addition** for `service_agent` |

Recommendation: human users authenticate via OIDC. Approver actions require step-up (WebAuthn or TOTP re-auth) before `approvals:decide` and `provider_actions:submit`. Workloads use OIDC to the cloud (`GitHub Actions` / cloud workload identity) and receive short-lived DB/object-store credentials from a secret manager. Never put a PAT or long-lived key in Git, CI logs or the agent terminal.

## Authorization (AuthZ)

| Option | Fit | Decision |
|---|---|---|
| Role matrix in-process (RBAC) | Simple, testable, matches AGENTS.md roles | **MVP** |
| ReBAC (OpenFGA / SpiceDB) | Better for deep merchant org trees | Defer |
| ABAC only | Hard to review | Use only as extra checks: same tenant, case ownership, source status |

MVP matrix lives in `@refund/domain` and is enforced again in SQL where a missed check would create money movement (`provider_actions` trigger). Tenant isolation is a hard predicate on every query (`tenant_id = current_actor.tenant_id`). Customers see only cases for orders with `ownership_verified_at`.

Two-person control: requester ≠ approver. Encoded in domain code and as `CHECK (approved_by IS NULL OR approved_by <> requested_by)`.

## Append-only audit

| Option | Pros | Cons | Decision |
|---|---|---|---|
| PostgreSQL insert-only + hash chain + triggers | Same operational plane as cases; cheap to test | Superuser can still rewrite WAL / restore | **System of record for MVP** |
| Application-only audit table | Easy | A missed repository method can UPDATE | Insufficient alone |
| immudb / QLDB / Snowflake UNDO | Stronger tamper evidence | Extra system, cost, operational skill | Evaluate in stage 4 |
| Object storage WORM copy | Survives DB rewrite | Eventual consistency | **Required complement** |

Contract implemented now:

1. Application computes SHA-256 over a canonical payload (`tenantId`, `occurredAt`, `actorId`, `action`, `entity`, `afterHash`, previous hash or `GENESIS`).
2. Events are tenant-scoped. The first event in a tenant has `prev_event_hash = NULL`.
3. SQL triggers reject `UPDATE`/`DELETE` and reject inserts whose `prev_event_hash` is not the latest hash for that tenant.
4. Payload is redacted. Banned keys include token, cookie, password, card data.
5. Off-box: ship the same event (or its hash + URI) to an immutable audit archive. The archive is not in this PR.

## Out of scope

- No AliExpress, Shopify or other provider SDK.
- No login proxy, cookie jar or session sharing between agents.
- No automatic refund or payout.
