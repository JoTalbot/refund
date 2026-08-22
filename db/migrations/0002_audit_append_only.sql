-- Append-only enforcement and hash-chain checks for audit_events.
-- Rollback: DROP TRIGGER / DROP FUNCTION listed in db/ROLLBACK.md.

CREATE OR REPLACE FUNCTION forbid_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS audit_events_no_update ON audit_events;
CREATE TRIGGER audit_events_no_update
  BEFORE UPDATE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION forbid_audit_mutation();

DROP TRIGGER IF EXISTS audit_events_no_delete ON audit_events;
CREATE TRIGGER audit_events_no_delete
  BEFORE DELETE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION forbid_audit_mutation();

CREATE OR REPLACE FUNCTION audit_events_enforce_chain()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  expected_prev text;
BEGIN
  IF NEW.event_hash IS NULL OR length(NEW.event_hash) <> 64 THEN
    RAISE EXCEPTION 'audit event_hash must be sha-256 hex';
  END IF;

  IF NEW.after_hash IS NULL OR length(NEW.after_hash) <> 64 THEN
    RAISE EXCEPTION 'audit after_hash must be sha-256 hex';
  END IF;

  SELECT event_hash
    INTO expected_prev
    FROM audit_events
   WHERE tenant_id = NEW.tenant_id
   ORDER BY seq DESC
   LIMIT 1;

  IF expected_prev IS DISTINCT FROM NEW.prev_event_hash THEN
    RAISE EXCEPTION 'audit hash chain mismatch for tenant %', NEW.tenant_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_events_chain ON audit_events;
CREATE TRIGGER audit_events_chain
  BEFORE INSERT ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION audit_events_enforce_chain();

CREATE OR REPLACE FUNCTION provider_actions_require_approval()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  approval_decision text;
  approval_case uuid;
  approved_by uuid;
  requested_by uuid;
BEGIN
  SELECT decision, case_id, approved_by, requested_by
    INTO approval_decision, approval_case, approved_by, requested_by
    FROM approval_requests
   WHERE id = NEW.approval_request_id
     AND tenant_id = NEW.tenant_id;

  IF approval_decision IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'provider_actions require an approved approval_request';
  END IF;

  IF approval_case IS DISTINCT FROM NEW.case_id THEN
    RAISE EXCEPTION 'provider_actions approval does not match case';
  END IF;

  IF approved_by IS NULL OR approved_by = requested_by THEN
    RAISE EXCEPTION 'provider_actions violate two-person control';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS provider_actions_approval_gate ON provider_actions;
CREATE TRIGGER provider_actions_approval_gate
  BEFORE INSERT ON provider_actions
  FOR EACH ROW
  EXECUTE FUNCTION provider_actions_require_approval();
