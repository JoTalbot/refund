# Iteration 2026-08-22 — runbook, ready/jobs, console, Shopify draft

## Goal

Ship the remaining checklist items that belong in Git: deploy runbook, CI OIDC Terraform, readiness and job list, a one-shot console path, and a Shopify own-store **draft** without an API client.

## Done

- `docs/RUNBOOK_DEPLOY_RU.md`
- `infra/terraform/github_oidc.tf`
- `GET /ready`, `GET /v1/jobs`
- Console: `/ready`, «прогнать весь сценарий», вкладка Shopify draft
- Source `shopify-merchant` status `draft`, migration `0005`

## Out of scope (intentional)

- Live Shopify Admin API client
- AliExpress connector
- Copying the workflow into `.github/workflows` (needs `workflows` permission on the GitHub App)

## Validation

`npm run ci`

## Rollback

`git revert`. SQL: delete `shopify-merchant` row (`db/ROLLBACK.md` §0005).
