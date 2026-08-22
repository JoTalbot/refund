---
name: agent-continuity
description: Use when work is performed by multiple agents, temporary environments, or parallel branches. Establishes durable state, task handoff, conflict control, Git delivery, and learn-from-runs practices.
---
# Agent Continuity

## Startup checklist
1. Read `AGENTS.md`, relevant skills and open tasks/PRs.
2. Fetch remote, create a scoped branch, announce file ownership.
3. Load configuration from secret manager and durable services; never assume prior local files or running processes exist.

## Durable handoff
- Commit code and declarative configuration atomically.
- Record job checkpoint, input/output artifact URIs, correlation ID, tool/version and outcome in durable storage.
- Write a short handoff in the PR/task: completed work, next step, risks, validation and rollback.
- Preserve only non-sensitive learning artefacts; version datasets, prompts, policies and extractor rules.

## Parallelism
- Use optimistic concurrency / row versions for business records and idempotency keys for side effects.
- Lease queue jobs with expiry; a new worker may safely resume after a vanished environment.
- Resolve integration conflicts by rebasing onto the target branch and rerunning checks; never force-push shared history.
