# Source: aliexpress-ua

```yaml
id: 11111111-1111-4111-8111-111111111111
slug: aliexpress-ua
status: draft
owner: platform-compliance
base_url: https://www.aliexpress.com/
permission_basis: Public official legal/help pages only. No API, scrape, login or cookie access.
policy_url: https://terms.alicdn.com/legal-agreement/terms/suit_bu1_aliexpress/suit_bu1_aliexpress201909171350_82407.html
rate_limit_per_minute: 0
allowed_fields:
  - public_help_url
  - policy_title
  - region_note
retention_days: 365
connector: none
```

## Review notes

- Source remains `draft`. Import workers must refuse it (`assertImportAllowed`).
- Automated catalog or order pull is **not** authorized.
- Operators may only point a verified order owner to official in-product flows and to `docs/providers/ALIEXPRESS_UA_BUYER_GUIDE_RU.md`.
- Re-review ToS/API/Privacy on a schedule or after a buyer complaint. If in doubt, keep `draft` or move to `suspended`, never `approved`.
