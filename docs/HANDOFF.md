# Handoff log

## Current recovery point
- **Latest completed iteration:** [`2026-08-22-002-research-protocol`](iterations/2026-08-22-002-research-protocol.md)
- **Working branch:** `agent/002-research-protocol`
- **Base foundation commit:** `30d236c` on `agent/001-foundation`; this iteration is layered on it.
- **Research decision:** API-first, merchant-authorised return flows only; build RBAC/audit/approval/idempotency before connecting any provider or source.
- **Next deterministic task:** `agent/003-auth-audit-contracts`.

## Operating requirements
1. Read `AGENTS.md`, this file, the last iteration and relevant skill before work.
2. Use `research-intelligence` before any material decision; write a dated research note.
3. Store runtime state externally; Git contains code, declarative artifacts, research and handoffs—not secrets, PII or production records.
4. End each change with a new iteration record, validation, atomic commit and push to an owned branch.

## Stage 1 foundation
- Adds: TypeScript workspaces, domain state machine tests, Fastify health API, worker skeleton, Postgres/Redis Compose declaration, initial schema, CI and secret scan.
- Validation baseline: `npm run ci` and `npm audit --omit=dev --audit-level=high` passed on the foundation branch.
- Rollback: revert the relevant branch commit; no deployed migration has been applied by this scaffold.
