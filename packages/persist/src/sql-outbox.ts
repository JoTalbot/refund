import type { OutboxEvent } from "@refund/domain";
import type { SqlQuery } from "./sql.js";

export class SqlOutboxStore {
  constructor(private readonly db: SqlQuery) {}

  async save(event: OutboxEvent): Promise<void> {
    await this.db.query(
      `INSERT INTO outbox_events (
         id, tenant_id, aggregate_type, aggregate_id, event_type, payload,
         created_at, published_at, published_attempts, last_error, idempotency_key
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET
         published_at = EXCLUDED.published_at,
         published_attempts = EXCLUDED.published_attempts,
         last_error = EXCLUDED.last_error,
         payload = EXCLUDED.payload`,
      [
        event.id,
        event.tenantId,
        event.aggregateType,
        event.aggregateId,
        event.eventType,
        JSON.stringify(event.payload),
        event.createdAt,
        event.publishedAt,
        event.publishedAttempts,
        event.lastError,
        event.idempotencyKey,
      ],
    );
  }

  async listUnpublished(limit = 50): Promise<OutboxEvent[]> {
    const result = await this.db.query<Record<string, unknown>>(
      `SELECT id, tenant_id, aggregate_type, aggregate_id, event_type, payload,
              created_at, published_at, published_attempts, last_error, idempotency_key
         FROM outbox_events
        WHERE published_at IS NULL
        ORDER BY created_at ASC
        LIMIT $1`,
      [limit],
    );
    return result.rows.map(rowToEvent);
  }

  async listAll(): Promise<OutboxEvent[]> {
    const result = await this.db.query<Record<string, unknown>>(
      `SELECT id, tenant_id, aggregate_type, aggregate_id, event_type, payload,
              created_at, published_at, published_attempts, last_error, idempotency_key
         FROM outbox_events
        ORDER BY created_at ASC`,
    );
    return result.rows.map(rowToEvent);
  }
}

function rowToEvent(row: Record<string, unknown>): OutboxEvent {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    aggregateType: String(row.aggregate_type),
    aggregateId: String(row.aggregate_id),
    eventType: String(row.event_type),
    payload: (row.payload as Record<string, unknown>) ?? {},
    createdAt: new Date(String(row.created_at)).toISOString(),
    publishedAt: row.published_at ? new Date(String(row.published_at)).toISOString() : null,
    publishedAttempts: Number(row.published_attempts ?? 0),
    lastError: row.last_error ? String(row.last_error) : null,
    idempotencyKey: String(row.idempotency_key),
  };
}
