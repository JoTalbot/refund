# Agent Operating Protocol v1.0

## Mandatory workflow

Every AI agent MUST:
1. Read `AGENTS.md`.
2. Read `.agents/STATUS.md`.
3. Check existing skills in `.agents/skills/`.
4. Research available approaches, documentation and repositories before implementation.
5. Create or update a research note when making architectural decisions.
6. Update status before starting implementation.
7. Keep ownership of assigned files and avoid conflicting edits.
8. Run tests and validations.
9. Convert reusable knowledge into a skill.
10. Update project memory before finishing.

## Agent handoff

The repository state must be understandable by a new agent joining from another machine. Local memory is not considered a source of truth.
