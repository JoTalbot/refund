# Iteration 2026-08-22-002-research-protocol

- **Status:** complete
- **Agent / branch:** Arena agent / `agent/002-research-protocol`
- **Started / completed (Europe/Kyiv):** 2026-08-22
- **Base commit / resulting commit:** `30d236c` / pending commit
- **Parent iteration:** `docs/HANDOFF.md`, Stage 1 foundation

## Objective and scope
Perform broad current research across official documents, maintained repositories and practitioner communities for lawful returns, catalog ingestion and resilient agent operations. Convert the result into a mandatory, portable agent operating protocol.

## Skills and current research consulted
- **Skills activated:** `agent-continuity`, `research-intelligence`.
- **Research note:** `docs/research/2026-08-22-landscape-and-operating-protocol.md`.
- **New skills considered:** Agent Skills format and community catalogs were reviewed; no external skill was vendored. A project-owned, evaluated `research-intelligence` skill was added.

## Changes and decisions
- Added mandatory external research loop to `AGENTS.md` for material decisions, with source hierarchy and untrusted-content guardrails.
- Added mandatory iteration/handoff/push protocol for reproducibility across ephemeral agents.
- Added an Agent Skills-compliant research skill, evaluation cases and research-note template.
- Recorded research decision: API-first, merchant-authorised Shopify sandbox first; source registry/approval/audit/idempotency before external actions; Temporal after core contracts.

## Validation
| Command / check | Result | Evidence / run ID |
|---|---|---|
| Review Agent Skills frontmatter vs specification | pass | `research-intelligence/SKILL.md` has compliant name/description |
| Source coverage | pass | official Shopify, WooCommerce, Temporal, Agent Skills; maintained repos; Reddit practitioner signals in research note |
| Secret/PII review | pass | no credentials, customer data or protected artifacts recorded |

## Durable context
- External state / checkpoint or artifact references: no runtime side effects; Git branch and research note are the durable handoff.
- Idempotency / recovery consideration: research mandates workflow checkpoints, receipts and keys for every external side effect.
- Sensitive-data note: no secrets or PII included in this record.

## Risks, rollback and open questions
- Primary API/docs can change; research has a 2026-11-22 revalidation date and integration-specific recheck requirement.
- Community recommendations may include impermissible circumvention techniques; these are explicitly non-actionable.
- SSH deploy key is ephemeral; future agents require a secret-managed key provisioned by CI/operator.

## Next deterministic step
Create `agent/003-auth-audit-contracts`: research current identity/RBAC options, then implement tenant-aware append-only audit contract and provider-action approval boundary. Do not implement a provider connector until this contract is reviewed.
