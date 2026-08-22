# Откат миграций

Целевая СУБД: PostgreSQL 16+. Миграции применяются в транзакции. План восстановления не удаляет WORM-копию аудита вне БД.

## 0002_audit_append_only.sql

```sql
BEGIN;
DROP TRIGGER IF EXISTS provider_actions_approval_gate ON provider_actions;
DROP FUNCTION IF EXISTS provider_actions_require_approval();
DROP TRIGGER IF EXISTS audit_events_chain ON audit_events;
DROP FUNCTION IF EXISTS audit_events_enforce_chain();
DROP TRIGGER IF EXISTS audit_events_no_delete ON audit_events;
DROP TRIGGER IF EXISTS audit_events_no_update ON audit_events;
DROP FUNCTION IF EXISTS forbid_audit_mutation();
COMMIT;
```

После отката 0002 вставки в `audit_events` снова допускают разрыв цепочки на уровне БД. Прикладной слой (`@refund/domain`) по-прежнему обязан считать hash chain.

## 0001_foundation.sql

Применять только если данные стенда можно потерять:

```sql
BEGIN;
DROP TABLE IF EXISTS outbox_events;
DROP TABLE IF EXISTS agent_runs;
DROP TABLE IF EXISTS audit_events;
DROP TABLE IF EXISTS provider_actions;
DROP TABLE IF EXISTS approval_requests;
DROP TABLE IF EXISTS case_attestations;
DROP TABLE IF EXISTS case_evidence;
DROP TABLE IF EXISTS return_cases;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS policy_snapshots;
DROP TABLE IF EXISTS product_observations;
DROP TABLE IF EXISTS source_products;
DROP TABLE IF EXISTS sources;
DROP TABLE IF EXISTS actors;
DROP TABLE IF EXISTS tenants;
-- pgcrypto не удаляем: расширение может использоваться другими схемами.
COMMIT;
```

Прод: не откатывать 0001. Вместо этого — PITR managed PostgreSQL и восстановление из backup. Аудит-архив в object storage не чистить.
