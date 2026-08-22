---
name: compliant-product-ingestion
description: Use when adding, changing, or operating a product catalog connector, feed importer, or web extractor. Enforces source authorization, provenance, rate limits, data minimization, and reproducible extraction.
---
# Compliant Product Ingestion

## Before implementation
1. Add the source to the registry with owner, URL/API terms, permission basis, allowed fields, rate limit, retention and approval status.
2. Prefer official API, affiliate feed, merchant export, or sanctioned partner integration. HTML extraction is last choice.
3. Stop if the source requires bypassing anti-bot controls, CAPTCHA, login restrictions, or contractual limitations.

## Implementation rules
- Use `source_id`, `extractor_version`, `fetched_at`, canonical URL, HTTP evidence reference, and field-level confidence/provenance.
- Enforce per-source concurrency and rate limit; honour robots/TOS where applicable.
- Keep an idempotent upsert key: `(source_id, source_product_id)`; store price observations append-only.
- Do not collect customer accounts, payment data, cookies, or unnecessary PII.
- Keep HTML/screenshots only if necessary, encrypted in object storage, with expiry.

## Acceptance checks
- Fixture-based parser tests and schema validation pass.
- A failed fetch creates a classified, retryable/non-retryable event; it never silently overwrites good data.
- Run metrics include freshness, success/error rate, parse coverage and source-policy status.
