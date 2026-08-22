# ADR 0001: Durable state outside agent environments

## Decision
Workers are stateless. PostgreSQL stores transactional data and idempotency records; object storage stores evidence/checkpoints; a durable workflow engine or lease queue owns job progression. Git stores source/IaC/skills, not operational data or secrets.

## Consequences
A lost environment may abandon a lease, but another worker can resume it after TTL. Every external side effect must use an idempotency key. Local files are cache only.
