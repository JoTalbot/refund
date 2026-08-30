---
name: remote-ref-audit
description: Audit a GitHub repository from an ephemeral checkout without confusing local, merged, unmerged, and deployed state. Use for architecture audits, handoffs, or PR reviews that rely on remote branches.
---
# Remote Reference Audit

## Purpose

Produce a durable, non-sensitive architecture or delivery assessment whose findings are tied to immutable Git refs. The procedure prevents stale local checkouts from being reported as the current project or production state.

## When to apply

- A repository audit, UASEP checkpoint, handoff, or PR review depends on GitHub state.
- The checkout is ephemeral, cloned shallowly, detached, or may not have `origin` configured.
- An open pull request or deployment status must be distinguished from `main`.

## Inputs

- Repository owner/name and the approved non-secret HTTPS remote URL.
- The local branch/HEAD under review.
- The default branch and any PR number or head ref to audit.
- Available validation commands and the environment's authentication boundary.

## Procedure

1. Read `AGENTS.md`, relevant status files, and the applicable domain skills. Claim the narrow documentation/skill files before editing.
2. Bootstrap the remote before fetching. If `origin` is absent, add the approved non-secret URL; if it exists, verify it points to the intended repository. Do not put credentials in the URL or Git config.
   ```bash
   audit_url='https://github.com/OWNER/REPOSITORY.git'
   if ! git remote get-url origin >/dev/null 2>&1; then
     git remote add origin "$audit_url"
   fi
   git remote get-url origin
   git fetch --prune origin '+refs/heads/*:refs/remotes/origin/*'
   ```
3. Record exact SHAs for local `HEAD`, `origin/<default-branch>`, and every PR/head ref used as evidence. Use GitHub API/CLI comments only when authentication is available; public data is not evidence of private reviews.
4. Inspect the ref-specific diff, architecture/runbook/handoff, dependency manifests, migrations, CI configuration, and source/provider controls. State separately what is merged, merely proposed, and actually deployed.
5. Run validation in an isolated worktree at the audited ref when feasible. State the SHA and commands; do not transfer a candidate test result to another ref or production.
6. Write/update the durable state, handoff, research record, and shared status. Include ownership, inputs, result, limitations, next step, and no secrets or PII.
7. Extract newly reusable findings into this or another scoped skill, run link/secret/Git checks, commit atomically, and deliver through the protected-branch PR workflow.

## Examples

### Audit an unmerged implementation

`origin/main` at `abc123` contains planning documents while PR #42 points to `origin/feature/returns` at `def456`. Record `main` as the merged baseline and PR #42 as an unmerged candidate; run tests from a worktree at `def456` and do not claim a production deployment.

### Resume in a checkout without remotes

A fresh agent receives an audit URL but `git remote -v` is empty. Add the approved HTTPS URL, fetch refs, verify the default branch SHA, then compare the requested PR ref with that SHA before writing any architecture conclusion.

## Limitations and safety constraints

- A remote ref proves repository content, not deployment, provider authorization, legal approval, or runtime health.
- Never treat a `draft` source, unmerged connector, or manual guidance as approval for provider automation.
- Never expose, commit, echo, or persist tokens. Use secret-manager/workload identity injection for authenticated operations and remove temporary credential helpers after use.
- Respect human approval, idempotency, append-only audit, PII minimization, and protected-branch controls for all refund-related work.
