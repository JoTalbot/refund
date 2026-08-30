# UASEP Project State

> Durable, non-sensitive checkpoint for continuing work from any ephemeral environment.

## Identity and checkpoint

| Field | Value |
|---|---|
| Repository | `JoTalbot/refund`; `origin` is configured as `https://github.com/JoTalbot/refund.git` |
| Branch at audit | `work` |
| Baseline commit | `2060cd0` (`Add testing skill`) |
| Checkpoint date | 2026-08-30 |
| Project stage | **Stage 0 — architecture and operating rules** |
| State owner | `/root` |
| Sensitive data | None; this state deliberately contains no credentials, customer data, tokens, or artifact contents |

## Scope confirmed from `README.md`

The planned product is a legitimate refund-operations platform: it uses approved catalog sources, verifies ownership of real orders, evaluates return eligibility, and submits provider requests only after human approval. It explicitly excludes fraudulent claims, bypassing platform controls, and use of third-party accounts.

## Architecture audit

### Present and coherent design decisions

| Area | Current design | Audit assessment |
|---|---|---|
| Product boundaries | Approved sources, genuine owned/administered orders, human-reviewed returns | Clear and safety-aligned. |
| Ingestion | Source Registry allowlist; API/feed/export before permitted HTML; provenance, rate limits, idempotent upserts | Sound; implementation must make `approved` status an enforced gate. |
| Returns | Explicit finite-state lifecycle; attestation, policy snapshot, approver-only submission, idempotency key | Sound safety model; formal transition table and tests are still required. |
| Durability | PostgreSQL, object storage, Temporal, transactional outbox, leases and idempotent consumers | Appropriate for ephemeral workers; no deployment declaration exists yet. |
| Security | RBAC, step-up for privileged approval, secret manager with workload identity, separate encrypted PII | Correct target architecture; no concrete identity/retention/control implementation exists yet. |
| Auditability | Append-only events plus WORM archive, evidence checksums, trace IDs | Appropriate target; tamper-evidence/retention implementation and verification remain open. |
| Delivery | Git/PR workflow and agent skills | Process documents exist, but remote, CI, branch protection, secret/dependency scanning and IaC are absent from this checkout. |

### Repository inventory

- The repository contains only planning documentation and agent process assets: `README.md`, `AGENTS.md`, `docs/`, `research/`, and `.agents/`.
- There is no application source directory, package/dependency manifest, database migration, API schema, workflow definition, container build, infrastructure declaration, CI workflow, or test file. The non-secret `origin` remote is configured, but no GitHub CLI authentication is available in this environment.
- The architecture document identifies TypeScript and Python alternatives but makes no binding ADR. The recommended TypeScript path is documented, not selected.
- The source register is a policy and research list, not a populated operational allowlist. No provider authorization is recorded.

### Findings, risks, and required resolution

| Priority | Finding | Consequence if unresolved | Required resolution |
|---|---|---|---|
| P0 | The GitHub remote is configured, but GitHub CLI authentication and protected-branch/PR access are not available in this environment. | Cannot create a PR or push the audit branch from this environment. | Authenticate GitHub CLI or provide a GitHub App/OIDC workflow with permission to push a feature branch and create a PR; verify branch protection outside this checkout. |
| P0 | Money-affecting approval, idempotency, and immutable audit controls are design-only. | A future implementation could submit duplicate or unapproved provider actions. | Implement an approval gate, unique/provider idempotency persistence, append-only audit writer, and transition tests before any provider submission. |
| P0 | No source registry data model or enforcement exists. | An unapproved connector could be introduced or run. | Implement the registry and require `approved` status plus recorded permission basis in every ingestion run. |
| P1 | No application skeleton, migrations, API contracts, IaC, CI, or automated tests exist. | The architecture cannot yet be deployed or validated. | Establish the Stage 1 vertical slice with repeatable local/CI validation and declarative managed-service infrastructure. |
| P1 | No ADR selects language, deployment platform, temporal topology, tenancy model, or identity provider. | Teams may implement incompatible foundations. | Record reviewed ADRs before scaffolding. |
| P1 | Data lifecycle needs concrete policies. | PII/evidence handling could violate minimization, retention, erasure, or legal-hold duties. | Define classifications, retention/erasure procedures, encryption/key ownership, access reviews, and audit archive verification. |
| P2 | Existing source/repository research is dated 2026-08-22. | Provider terms/API behavior may have changed. | Revalidate each proposed source/API immediately before enabling it and retain a dated authorization record. |
| P2 | UASEP has no repository-local specification and the public lookup was unavailable. | Future workers may interpret the durable-state format differently. | Treat these three state files as the current contract; replace/extend only after an authoritative UASEP specification is available. |

## Recommended target sequence

1. Complete delivery foundation: authorized GitHub remote, protected-branch policy, CI, secret/dependency/license scanning, CODEOWNERS, and ADRs.
2. Implement one approved catalog vertical slice: registry → authorized feed/API → normalized product and observation → provenance/evidence → parser/schema tests.
3. Implement internal case management with no external provider submission: order ownership verification, snapshots, eligibility, evidence, RBAC, audited state machine.
4. Add one merchant-controlled, sandboxed return integration behind human approval, durable idempotency, reconciliation, and sandbox tests.
5. Perform resilience and compliance hardening: restore/worker-loss exercises, retention/DLP, SLOs, security review, and periodic source-policy revalidation.

## Research record

- Reviewed repository-local architecture and source research, agent protocol, roles, and available skills.
- Applied `agent-continuity` for non-sensitive durable handoff, `research` for the audit sequence, and `testing` for validation planning.
- Attempted a public search for a UASEP durable-state specification; it failed with HTTP 401. No external source is asserted as authoritative.
- Selected a small Markdown state contract because it is versioned in Git, legible in a fresh environment, contains no secrets/runtime state, and matches the repository's existing status/handoff conventions.
