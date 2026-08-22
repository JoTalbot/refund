# Source: shopify-merchant

```yaml
id: 33333333-3333-4333-8333-333333333333
slug: shopify-merchant
status: draft
owner: platform-compliance
base_url: https://shopify.dev/docs/api/admin-graphql
permission_basis: Own-store Admin GraphQL after merchant OAuth and registry approval
policy_url: https://shopify.dev/docs/apps/build/orders-fulfillment/returns-apps
rate_limit_per_minute: 0
connector: none
scopes_planned:
  - read_orders
  - write_returns
  - read_returns
  - read_products
```

## Rules

- This is **not** an approved connector. Import and Admin API calls are forbidden.
- Only the merchant who administers the shop may later request `review` → `approved`.
- Least privilege: no `read_customers` / payment scopes unless a written need exists.
- Tokens live in the secret manager (`SHOPIFY_ADMIN_TOKEN_SECRET_ID`), never in Git.
- Official docs: [Returns apps](https://shopify.dev/docs/apps/build/orders-fulfillment/returns-apps), [Refund resource](https://shopify.dev/docs/api/admin-rest/latest/resources/refund).
