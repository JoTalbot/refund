-- Durable import runs and job leases. Rollback: db/ROLLBACK.md

CREATE TABLE import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  source_id uuid NOT NULL REFERENCES sources (id),
  kind text NOT NULL CHECK (kind IN ('merchant_export')),
  status text NOT NULL CHECK (status IN ('succeeded', 'failed', 'blocked')),
  extractor_version text NOT NULL,
  idempotency_key text NOT NULL,
  products_upserted integer NOT NULL DEFAULT 0,
  observations_appended integer NOT NULL DEFAULT 0,
  error_class text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE job_leases (
  run_id uuid PRIMARY KEY,
  job_type text NOT NULL,
  owner_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  checkpoint_uri text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1
);

CREATE INDEX job_leases_expiry ON job_leases (expires_at);
