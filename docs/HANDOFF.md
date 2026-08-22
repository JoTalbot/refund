# Handoff log

## 2026-08-22 — Stage 1 foundation
- Branch: `agent/001-foundation`
- Adds: TypeScript workspaces, domain state machine tests, Fastify health API, worker skeleton, Postgres/Redis Compose declaration, initial schema, CI and secret scan.
- Persistence: PostgreSQL/Redis/object storage are external runtime dependencies; no runtime data is stored in this repository.
- Validation: `npm run ci`.
- Rollback: revert this commit; no deployed migration has been applied by this repository scaffold.
- Next: provision managed Postgres/object storage/queue, then implement auth/RBAC and audit writer before connecting a data source.
