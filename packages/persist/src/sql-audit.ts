import { randomUUID } from "node:crypto";
import type { AuditEvent, AuditStore } from "@refund/domain";
import type { SqlQuery } from "./sql.js";

export class SqlAuditStore implements AuditStore {
  constructor(private readonly db: SqlQuery) {}

  async ensureTenant(tenantId: string, slug = "tenant"): Promise<void> {
    await this.db.query(
      `INSERT INTO tenants (id, slug, name) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [tenantId, `${slug}-${tenantId.slice(0, 8)}`, slug],
    );
  }

  async latestHashAsync(tenantId: string): Promise<string | null> {
    const result = await this.db.query<{ event_hash: string }>(
      `SELECT event_hash FROM audit_events WHERE tenant_id = $1 ORDER BY seq DESC LIMIT 1`,
      [tenantId],
    );
    return result.rows[0]?.event_hash ?? null;
  }

  latestHash(tenantId: string): string | null {
    throw new Error(`use latestHashAsync for SQL store (${tenantId})`);
  }

  insert(_event: AuditEvent): void {
    throw new Error("use insertAsync for SQL store");
  }

  async insertAsync(event: AuditEvent): Promise<void> {
    await this.ensureTenant(event.tenantId);
    await this.db.query(
      `INSERT INTO audit_events (
        id, tenant_id, occurred_at, actor_id, actor_role, action, entity_type, entity_id,
        case_id, policy_version, provider_correlation_id, before_hash, after_hash,
        prev_event_hash, event_hash, trace_id, payload_redacted
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb
      )`,
      [
        event.id,
        event.tenantId,
        event.occurredAt,
        event.actorId,
        event.actorRole,
        event.action,
        event.entityType,
        event.entityId,
        event.caseId ?? null,
        event.policyVersion ?? null,
        event.providerCorrelationId ?? null,
        event.beforeHash ?? null,
        event.afterHash,
        event.prevEventHash,
        event.eventHash,
        event.traceId,
        JSON.stringify(event.payloadRedacted),
      ],
    );
  }

  async listByCase(tenantId: string, caseId?: string): Promise<AuditEvent[]> {
    const result = await this.db.query<Record<string, unknown>>(
      caseId
        ? `SELECT * FROM audit_events WHERE tenant_id = $1 AND case_id = $2 ORDER BY seq`
        : `SELECT * FROM audit_events WHERE tenant_id = $1 ORDER BY seq`,
      caseId ? [tenantId, caseId] : [tenantId],
    );
    return result.rows.map((row) => ({
      id: String(row.id ?? randomUUID()),
      tenantId: String(row.tenant_id),
      occurredAt: new Date(String(row.occurred_at)).toISOString(),
      actorId: String(row.actor_id),
      actorRole: row.actor_role as AuditEvent["actorRole"],
      action: String(row.action),
      entityType: String(row.entity_type),
      entityId: String(row.entity_id),
      afterHash: String(row.after_hash),
      prevEventHash: row.prev_event_hash ? String(row.prev_event_hash) : null,
      eventHash: String(row.event_hash),
      traceId: String(row.trace_id),
      payloadRedacted: (row.payload_redacted as Record<string, unknown>) ?? {},
      caseId: row.case_id ? String(row.case_id) : undefined,
      policyVersion: row.policy_version ? String(row.policy_version) : undefined,
    }));
  }
}
