-- Outbox delivery metadata, evidence legal hold, and erasure timestamps.
-- Rollback: see db/ROLLBACK.md §0006.

ALTER TABLE case_evidence
  ADD COLUMN IF NOT EXISTS legal_hold boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS erased_at timestamptz;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS erased_at timestamptz;

ALTER TABLE outbox_events
  ADD COLUMN IF NOT EXISTS published_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

UPDATE outbox_events
   SET idempotency_key = id::text
 WHERE idempotency_key IS NULL;

ALTER TABLE outbox_events
  ALTER COLUMN idempotency_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS outbox_events_tenant_idempotency
  ON outbox_events (tenant_id, idempotency_key);

CREATE INDEX IF NOT EXISTS outbox_events_unpublished
  ON outbox_events (created_at)
  WHERE published_at IS NULL;
