---
name: research-intelligence
description: Use when comparing vendors, laws, APIs, or identity/audit options. Produces dated evidence registers, not implementation of connectors.
---
# Research Intelligence

## Rules
1. Prefer primary official URLs. Record retrieval date and whether the live page was reachable.
2. Separate fact, inference and recommendation.
3. If a marketplace ToS or API agreement forbids storage or automated access, say so and keep the Source Registry at `draft`.
4. Do not collect credentials, cookies or customer PII into the research note.
5. Unstable promotional URLs belong in the evidence register with status `live_unstable`; do not build scrapers to “fix” a 404.

## Output
- `docs/research/YYYY-MM-DD-<topic>.md` with an evidence table.
- Update the related source file if the legal basis changed.
- Link the note from the iteration/handoff record.
