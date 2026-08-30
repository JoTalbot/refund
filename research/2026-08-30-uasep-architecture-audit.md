# UASEP Architecture Audit — 2026-08-30 (corrected)

## Problem

The first audit examined only the local checkout and therefore omitted live GitHub work. This correction audits the requested repository by exact remote refs and records conclusions without conflating unmerged code, `main`, and deployment state.

## Sources reviewed

- Local root instructions, statuses, architecture/source documents and applicable agent skills.
- GitHub public API for open pull requests, inline review comments and issue comments.
- Remote refs fetched from `https://github.com/JoTalbot/refund.git`.
- PR #3 (`arena/01a028f5-refund`, `d85510a`): diff inventory, README, architecture, threat model, deployment runbook, handoff and package scripts.

## Findings

`origin/main` (`2060cd0`) is a documentation-oriented Stage 0 baseline. PR #3 is an unmerged Stage 0–2 implementation candidate: it adds TypeScript domain/persistence packages, API and worker apps, migrations, source fixtures, Terraform skeleton, threat model, runbook and tests. Its documented boundary remains safe: sources are `draft`, marketplace HTTP clients are absent, and provider action is manual-guidance only.

PR #3 has no public inline or issue comments at the time of review. In an isolated worktree, `npm ci && npm run ci` passed. The GitHub Actions configuration is a template and must still be installed by a repository owner; live service bindings and production evidence were not present.

## Selected approach

The durable state now treats Git refs as first-class evidence: each conclusion names whether it applies to `main`, an open PR, or production. This prevents a future ephemeral agent from making the same stale-local-checkout error.
