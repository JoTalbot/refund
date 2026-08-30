# UASEP Project State

> Durable, non-sensitive checkpoint. Repository state is recorded by ref so a continuation agent never mistakes an unmerged implementation for deployed or merged code.

## Checkpoint identity

| Field | Value |
|---|---|
| GitHub repository | `JoTalbot/refund` |
| Read-only remote used for audit | `https://github.com/JoTalbot/refund.git` |
| Local audit branch | `work` at `a5b0555` before this correction |
| Merged baseline | `origin/main` at `2060cd0` |
| Open implementation candidate | PR [#3](https://github.com/JoTalbot/refund/pull/3), `origin/arena/01a028f5-refund` at `d85510a` |
| Checkpoint date | 2026-08-30 |
| State owner | `/root` |
| Sensitive data | None; no credentials, customer data, tokens, or runtime artifacts are recorded |

## Correct development-stage assessment

The previous checkpoint incorrectly audited only the local branch and described the entire project as documentation-only. That classification applies **only to `main` at `2060cd0`**. It does not describe the current GitHub work in PR #3.

| Ref | Stage | Evidence and interpretation |
|---|---|---|
| `origin/main` | Stage 0 planning baseline | Agent process, architecture, source-research and skills documentation; no runtime implementation. |
| PR #3 / `origin/arena/01a028f5-refund` | **Unmerged Stage 0–2 implementation candidate** | TypeScript workspaces, domain controls, HTTP API, worker, PostgreSQL migrations, fixtures, Terraform skeleton, CI template, deployment runbook, and tests are present. |
| Production | Not established | PR #3 documents unbound live PostgreSQL, Temporal, object storage, OIDC deployment binding, and no marketplace connector. No production deployment evidence was audited. |

## PR #3 architecture audit

### Confirmed implementation and controls

| Area | Audit result |
|---|---|
| Approval and money boundary | Domain package has a two-person approval gate, idempotency controls and audited state transitions; provider actions remain manual-guidance only. |
| Source authorization | Registry fixtures and checks keep `aliexpress-ua` and `shopify-merchant` in `draft`; no marketplace HTTP connector is included. |
| Data durability | PostgreSQL migrations, SQL snapshot/rehydration, jobs/import runs, transactional outbox, object-store port, PII erasure and legal hold are implemented as a foundation. |
| Security | RBAC, verified OIDC/JWKS handling, structured redacted logs, secret scanning, connector prohibition, and Terraform GitHub OIDC skeleton are present. |
| Delivery | `npm run ci` is defined and passed in an isolated checkout of PR #3. The GitHub Actions workflow is intentionally a template under `docs/ci/`, so repository-owner action is still required to activate CI. |
| Runtime bindings | Live managed PostgreSQL, secret manager, Temporal, object storage and production identity are intentionally unbound; they must be supplied through reviewed deployment configuration, never Git secrets. |

### Review scope and result

- GitHub public API was queried for open PRs and review/issue comments. PR #3 is open; no inline review comments or issue comments were returned at audit time.
- An isolated worktree at `d85510a` ran `npm ci && npm run ci` successfully. This validates the candidate code at that SHA, **not** `main`, `work`, a deployed environment, or a provider integration.

## Prioritized completion backlog

1. **P0 — merge gate:** complete review of PR #3, require its CI in GitHub, and merge only through the protected branch. The current CI template must be installed at `.github/workflows/ci.yml` by an authorized repository owner.
2. **P0 — deployment safety:** bind managed PostgreSQL/PITR, external WORM audit archive, secret manager, production OIDC and monitored worker using Terraform/CI OIDC; perform restore and lost-worker drills before production data.
3. **P0 — authorization enforcement:** retain `draft` source blocks and manual-only provider actions until a merchant-owned, contractually approved source has a documented approval record and OAuth/least-privilege scopes.
4. **P1 — first approved integration:** use a merchant-controlled Shopify sandbox, implement human approval, persistent provider idempotency, webhook signature verification and reconciliation tests; do not implement an AliExpress connector.
5. **P1 — operations:** establish SLOs, alerting, access review, DLP/retention jobs, legal review cadence and production runbooks.
6. **P2 — architecture governance:** create ADRs for tenancy, deployment topology, Temporal service choice, WORM verification and key ownership before widening scope.

## Research and method

- Read root instructions, shared status, applicable `agent-continuity`, `research`, and `testing` skills, local architecture/source documents, and the open remote PR.
- Fetched all remote branches, inspected the PR diff and its architecture, threat-model, runbook, handoff and package scripts.
- Public UASEP-format lookup remains unavailable (HTTP 401), so the requested Markdown files remain the repository-compatible state contract.
- Extracted the successful ref-aware remote-audit process into `.agents/skills/remote-ref-audit/SKILL.md`; its bootstrap step makes no assumption that `origin` exists in a fresh checkout.
