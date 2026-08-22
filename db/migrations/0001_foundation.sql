-- Refund Operations Platform foundation schema.
-- Target: PostgreSQL 16+. Apply in a transaction.
-- Rollback: see db/ROLLBACK.md (drop objects created here, then 0002).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE actors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  external_subject text NOT NULL,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, external_subject)
);

CREATE TABLE sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants (id),
  slug text NOT NULL UNIQUE,
  owner text NOT NULL,
  base_url text NOT NULL,
  permission_basis text NOT NULL,
  policy_url text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'review', 'approved', 'suspended')),
  rate_limit_per_minute integer NOT NULL CHECK (rate_limit_per_minute >= 0),
  allowed_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  retention_days integer NOT NULL CHECK (retention_days > 0),
  region_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE source_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES sources (id),
  external_id text NOT NULL,
  canonical_url text NOT NULL,
  title text NOT NULL,
  brand text,
  sku text,
  extractor_version text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, external_id)
);

CREATE TABLE product_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_product_id uuid NOT NULL REFERENCES source_products (id),
  observed_at timestamptz NOT NULL,
  price_amount numeric(18, 4) NOT NULL,
  price_currency char(3) NOT NULL,
  availability text NOT NULL CHECK (availability IN ('in_stock', 'out_of_stock', 'unknown')),
  evidence_uri text
);

CREATE TABLE policy_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES sources (id),
  version text NOT NULL,
  content_hash text NOT NULL,
  effective_at timestamptz NOT NULL,
  rules_json jsonb NOT NULL,
  evidence_uri text,
  UNIQUE (source_id, version)
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  provider text NOT NULL,
  external_id text NOT NULL,
  ownership_verified_at timestamptz,
  pii_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, external_id)
);

CREATE TABLE return_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  order_id uuid NOT NULL REFERENCES orders (id),
  state text NOT NULL,
  eligibility text NOT NULL CHECK (eligibility IN ('eligible', 'ineligible', 'needs_review')),
  policy_snapshot_id uuid REFERENCES policy_snapshots (id),
  version integer NOT NULL DEFAULT 1,
  attested_at timestamptz,
  attested_by uuid REFERENCES actors (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT return_cases_state_check CHECK (
    state IN (
      'draft',
      'evidence_pending',
      'submitted_for_approval',
      'approved_for_submission',
      'submitted',
      'merchant_review',
      'return_in_transit',
      'received',
      'resolved',
      'rejected',
      'cancelled'
    )
  )
);

CREATE TABLE case_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES return_cases (id),
  object_uri text NOT NULL,
  checksum text NOT NULL,
  classification text NOT NULL,
  expires_at timestamptz
);

CREATE TABLE case_attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES return_cases (id),
  actor_id uuid NOT NULL REFERENCES actors (id),
  attested_at timestamptz NOT NULL DEFAULT now(),
  statement text NOT NULL
);

CREATE TABLE approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  case_id uuid NOT NULL REFERENCES return_cases (id),
  requested_by uuid NOT NULL REFERENCES actors (id),
  approved_by uuid REFERENCES actors (id),
  decision text NOT NULL CHECK (decision IN ('pending', 'approved', 'rejected')),
  reason text NOT NULL,
  policy_version text NOT NULL,
  idempotency_key text NOT NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key),
  CHECK (approved_by IS NULL OR approved_by <> requested_by)
);

CREATE UNIQUE INDEX approval_requests_one_pending
  ON approval_requests (case_id)
  WHERE decision = 'pending';

CREATE TABLE provider_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  case_id uuid NOT NULL REFERENCES return_cases (id),
  approval_request_id uuid NOT NULL REFERENCES approval_requests (id),
  provider text NOT NULL,
  action_type text NOT NULL,
  idempotency_key text NOT NULL,
  request_ref text,
  response_ref text,
  status text NOT NULL CHECK (
    status IN ('queued', 'submitted', 'acknowledged', 'failed', 'cancelled')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE audit_events (
  seq bigserial PRIMARY KEY,
  id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id text NOT NULL,
  actor_role text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  case_id uuid,
  policy_version text,
  provider_correlation_id text,
  before_hash text,
  after_hash text NOT NULL,
  prev_event_hash text,
  event_hash text NOT NULL,
  trace_id text NOT NULL,
  payload_redacted jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_tenant_seq ON audit_events (tenant_id, seq);
CREATE INDEX audit_events_case ON audit_events (case_id);
CREATE UNIQUE INDEX audit_events_tenant_hash ON audit_events (tenant_id, event_hash);

CREATE TABLE agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_version text NOT NULL,
  tool_versions jsonb NOT NULL DEFAULT '{}'::jsonb,
  input_ref text,
  output_ref text,
  metrics_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  outcome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

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
  '11111111-1111-4111-8111-111111111111',
  'aliexpress-ua',
  'platform-compliance',
  'https://www.aliexpress.com/',
  'Public buyer help and official legal pages only. No API, scrape, login or cookie access.',
  'https://terms.alicdn.com/legal-agreement/terms/suit_bu1_aliexpress/suit_bu1_aliexpress201909171350_82407.html',
  'draft',
  0,
  '["public_help_url", "policy_title", "region_note"]'::jsonb,
  365,
  'Ukraine buyer self-serve guidance. Free Return / local warehouse is often unavailable.'
);
