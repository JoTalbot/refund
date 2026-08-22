-- Draft Shopify own-store source. No connector. Rollback: db/ROLLBACK.md

INSERT INTO sources (
  id,
  slug,
  owner,
  base_url,
  permission_basis,
  policy_url,
  status,
  rate_limit_per_minute,
  allowed_fields,
  retention_days,
  region_notes
) VALUES (
  '33333333-3333-4333-8333-333333333333',
  'shopify-merchant',
  'platform-compliance',
  'https://shopify.dev/docs/api/admin-graphql',
  'Own-store Admin GraphQL only after merchant OAuth, least-privilege scopes, and Source Registry approved.',
  'https://shopify.dev/docs/apps/build/orders-fulfillment/returns-apps',
  'draft',
  0,
  '["shop_domain", "return_policy_url", "scopes"]'::jsonb,
  365,
  'Sandbox/draft. No Admin API client until status is approved.'
)
ON CONFLICT (slug) DO NOTHING;
