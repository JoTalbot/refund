CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TYPE source_status AS ENUM ('draft', 'review', 'approved', 'suspended');
CREATE TYPE return_case_state AS ENUM ('draft', 'evidence_pending', 'submitted_for_approval', 'approved_for_submission', 'submitted', 'merchant_review', 'return_in_transit', 'received', 'resolved', 'rejected', 'cancelled');
CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), external_subject text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, external_subject)
);
CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), name text NOT NULL, UNIQUE (tenant_id, name)
);
CREATE TABLE user_roles (user_id uuid NOT NULL REFERENCES users(id), role_id uuid NOT NULL REFERENCES roles(id), PRIMARY KEY (user_id, role_id));
CREATE TABLE sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), owner text NOT NULL, base_url text NOT NULL, permission_basis text NOT NULL, policy_url text, status source_status NOT NULL DEFAULT 'draft', rate_limit_per_minute integer NOT NULL CHECK (rate_limit_per_minute > 0), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), actor_id uuid REFERENCES users(id), action text NOT NULL, entity_type text NOT NULL, entity_id uuid NOT NULL, trace_id uuid NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(), metadata jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX audit_events_entity_idx ON audit_events (tenant_id, entity_type, entity_id, occurred_at);
CREATE TABLE return_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), order_id uuid, state return_case_state NOT NULL DEFAULT 'draft', version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE workflow_leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_type text NOT NULL, idempotency_key text NOT NULL UNIQUE, status text NOT NULL, lease_expires_at timestamptz, checkpoint_uri text, updated_at timestamptz NOT NULL DEFAULT now()
);
