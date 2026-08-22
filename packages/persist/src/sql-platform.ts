import { ROLES, type Actor, type Role } from "@refund/domain";
import { actorRowId, isUuid } from "./ids.js";
import { emptySnapshot, type PlatformSnapshot } from "./snapshot.js";
import type { SqlQuery } from "./sql.js";

export class SqlPlatformStore {
  constructor(private readonly db: SqlQuery) {}

  async saveSnapshot(snapshot: PlatformSnapshot): Promise<void> {
    const tenants = new Set<string>();
    for (const item of [
      ...snapshot.orders,
      ...snapshot.cases,
      ...snapshot.approvals,
      ...snapshot.actions,
      ...snapshot.imports,
      ...snapshot.actors,
    ]) {
      tenants.add(item.tenantId);
    }
    for (const source of snapshot.sources) {
      if (source.tenantId) tenants.add(source.tenantId);
    }
    for (const tenantId of tenants) {
      await this.db.query(
        `INSERT INTO tenants (id, slug, name) VALUES ($1::uuid, $2, $3) ON CONFLICT (id) DO NOTHING`,
        [tenantId, tenantId, `tenant-${tenantId.slice(0, 8)}`],
      );
    }

    const actors = new Map<string, Actor>();
    for (const actor of snapshot.actors) {
      actors.set(`${actor.tenantId}:${actor.id}`, actor);
    }
    const remember = (tenantId: string, subject: string | null | undefined, fallback: Role) => {
      if (!subject) return;
      const key = `${tenantId}:${subject}`;
      if (!actors.has(key)) {
        actors.set(key, { id: subject, tenantId, role: inferRole(subject, fallback), stepUpVerified: false });
      }
    };
    for (const item of snapshot.cases) {
      remember(item.tenantId, item.attestedBy, "customer");
    }
    for (const item of snapshot.approvals) {
      remember(item.tenantId, item.requestedBy, "customer");
      remember(item.tenantId, item.approvedBy, "approver");
    }
    for (const actor of actors.values()) {
      await this.db.query(
        `INSERT INTO actors (id, tenant_id, external_subject, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tenant_id, external_subject) DO UPDATE SET role = EXCLUDED.role`,
        [actorRowId(actor.tenantId, actor.id), actor.tenantId, actor.id, actor.role],
      );
    }

    for (const source of snapshot.sources) {
      await this.db.query(
        `INSERT INTO sources (
          id, tenant_id, slug, owner, base_url, permission_basis, policy_url, status,
          rate_limit_per_minute, allowed_fields, retention_days, region_notes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          owner = EXCLUDED.owner,
          rate_limit_per_minute = EXCLUDED.rate_limit_per_minute,
          region_notes = EXCLUDED.region_notes`,
        [
          source.id,
          source.tenantId ?? null,
          source.slug,
          source.owner,
          source.baseUrl,
          source.permissionBasis,
          source.policyUrl,
          source.status,
          source.rateLimitPerMinute,
          JSON.stringify(source.allowedFields),
          source.retentionDays,
          source.regionNotes,
        ],
      );
    }

    for (const product of snapshot.products) {
      await this.db.query(
        `INSERT INTO source_products (
          id, source_id, external_id, canonical_url, title, brand, sku, extractor_version
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (source_id, external_id) DO UPDATE SET
          title = EXCLUDED.title,
          brand = EXCLUDED.brand,
          sku = EXCLUDED.sku,
          extractor_version = EXCLUDED.extractor_version,
          canonical_url = EXCLUDED.canonical_url`,
        [
          product.id,
          product.sourceId,
          product.sourceProductId,
          product.canonicalUrl,
          product.title,
          product.brand,
          product.sku,
          product.extractorVersion,
        ],
      );
    }

    for (const observation of snapshot.observations) {
      const product = snapshot.products.find((item) => item.sourceProductId === observation.sourceProductId);
      if (!product) continue;
      await this.db.query(
        `INSERT INTO product_observations (
          id, source_product_id, observed_at, price_amount, price_currency, availability, evidence_uri
        ) VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (id) DO NOTHING`,
        [
          observation.id,
          product.id,
          observation.observedAt,
          observation.price.amount,
          observation.price.currency,
          observation.availability,
          observation.evidenceUri,
        ],
      );
    }

    for (const policy of snapshot.policies) {
      await this.db.query(
        `INSERT INTO policy_snapshots (
          id, source_id, version, content_hash, effective_at, rules_json, evidence_uri
        ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
        ON CONFLICT (id) DO UPDATE SET rules_json = EXCLUDED.rules_json`,
        [
          policy.id,
          isUuid(policy.sourceId) ? policy.sourceId : null,
          policy.version,
          policy.contentHash,
          policy.effectiveAt,
          JSON.stringify(policy.rules),
          policy.evidenceUri,
        ],
      );
    }

    for (const order of snapshot.orders) {
      await this.db.query(
        `INSERT INTO orders (id, tenant_id, provider, external_id, ownership_verified_at, pii_ref, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO UPDATE SET ownership_verified_at = EXCLUDED.ownership_verified_at`,
        [
          order.id,
          order.tenantId,
          order.provider,
          order.externalId,
          order.ownershipVerifiedAt,
          order.piiRef,
          order.createdAt,
        ],
      );
      await this.db.query(`DELETE FROM order_lines WHERE order_id = $1`, [order.id]);
      for (const line of order.lines) {
        await this.db.query(
          `INSERT INTO order_lines (order_id, sku, title, quantity, amount, currency)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [order.id, line.sku, line.title, line.quantity, line.amount, line.currency],
        );
      }
    }

    for (const item of snapshot.cases) {
      await this.db.query(
        `INSERT INTO return_cases (
          id, tenant_id, order_id, state, eligibility, policy_snapshot_id, version,
          attested_at, attested_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (id) DO UPDATE SET
          state = EXCLUDED.state,
          eligibility = EXCLUDED.eligibility,
          version = EXCLUDED.version,
          attested_at = EXCLUDED.attested_at,
          attested_by = EXCLUDED.attested_by`,
        [
          item.id,
          item.tenantId,
          item.orderId,
          item.state,
          item.eligibility,
          item.policySnapshotId,
          item.version,
          item.attestedAt,
          item.attestedBy ? actorRowId(item.tenantId, item.attestedBy) : null,
        ],
      );
    }

    for (const item of snapshot.evidence) {
      await this.db.query(
        `INSERT INTO case_evidence (id, case_id, object_uri, checksum, classification, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO NOTHING`,
        [item.id, item.caseId, item.objectUri, item.checksum, item.classification, item.expiresAt],
      );
    }

    for (const item of snapshot.approvals) {
      await this.db.query(
        `INSERT INTO approval_requests (
          id, tenant_id, case_id, requested_by, approved_by, decision, reason,
          policy_version, idempotency_key, decided_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (id) DO UPDATE SET
          decision = EXCLUDED.decision,
          approved_by = EXCLUDED.approved_by,
          decided_at = EXCLUDED.decided_at,
          reason = EXCLUDED.reason`,
        [
          item.id,
          item.tenantId,
          item.caseId,
          actorRowId(item.tenantId, item.requestedBy),
          item.approvedBy ? actorRowId(item.tenantId, item.approvedBy) : null,
          item.decision,
          item.reason,
          item.policyVersion,
          item.idempotencyKey,
          item.decidedAt,
        ],
      );
    }

    // provider_actions and audit_events use RAISE triggers that crash PGlite.
    // Persist them only when the engine can execute those triggers (managed Postgres).
    if (process.env.PERSIST_TRIGGER_WRITES === "1") {
      for (const item of snapshot.actions) {
        await this.db.query(
          `INSERT INTO provider_actions (
            id, tenant_id, case_id, approval_request_id, provider, action_type,
            idempotency_key, request_ref, response_ref, status
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
          [
            item.id,
            item.tenantId,
            item.caseId,
            item.approvalRequestId,
            item.provider,
            item.actionType,
            item.idempotencyKey,
            item.requestRef,
            item.responseRef,
            item.status,
          ],
        );
      }
    }

    for (const item of snapshot.imports) {
      await this.db.query(
        `INSERT INTO import_runs (
          id, tenant_id, source_id, kind, status, extractor_version, idempotency_key,
          products_upserted, observations_appended, error_class, error_message, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
        [
          item.id,
          item.tenantId,
          item.sourceId,
          item.kind,
          item.status,
          item.extractorVersion,
          item.idempotencyKey,
          item.productsUpserted,
          item.observationsAppended,
          item.errorClass,
          item.errorMessage,
          item.createdAt,
        ],
      );
    }

    if (process.env.PERSIST_TRIGGER_WRITES === "1") {
      for (const event of snapshot.audit) {
        await this.db.query(
          `INSERT INTO audit_events (
            id, tenant_id, occurred_at, actor_id, actor_role, action, entity_type, entity_id,
            case_id, policy_version, provider_correlation_id, before_hash, after_hash,
            prev_event_hash, event_hash, trace_id, payload_redacted
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb)
          ON CONFLICT (id) DO NOTHING`,
          [
            event.id,
            event.tenantId,
            event.occurredAt,
            event.actorId,
            event.actorRole,
            event.action,
            event.entityType,
            event.entityId,
            event.caseId && isUuid(event.caseId) ? event.caseId : null,
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
    }
  }

  async loadSnapshot(): Promise<PlatformSnapshot> {
    const snapshot = emptySnapshot();

    const actorRows = await this.db.query<Record<string, unknown>>(
      `SELECT id, tenant_id, external_subject, role FROM actors`,
    );
    const actorById = new Map<string, string>();
    for (const row of actorRows.rows) {
      actorById.set(String(row.id), String(row.external_subject));
      snapshot.actors.push({
        id: String(row.external_subject),
        tenantId: String(row.tenant_id),
        role: row.role as Actor["role"],
        stepUpVerified: false,
      });
    }

    const sourceRows = await this.db.query<Record<string, unknown>>(`SELECT * FROM sources`);
    snapshot.sources = sourceRows.rows.map((row) => ({
      id: String(row.id),
      tenantId: row.tenant_id ? String(row.tenant_id) : null,
      slug: String(row.slug),
      owner: String(row.owner),
      baseUrl: String(row.base_url),
      permissionBasis: String(row.permission_basis),
      policyUrl: String(row.policy_url),
      status: row.status as SourceRecordStatus,
      rateLimitPerMinute: Number(row.rate_limit_per_minute),
      allowedFields: asStringArray(row.allowed_fields),
      retentionDays: Number(row.retention_days),
      regionNotes: String(row.region_notes ?? ""),
    }));

    const productRows = await this.db.query<Record<string, unknown>>(`SELECT * FROM source_products`);
    snapshot.products = productRows.rows.map((row) => ({
      id: String(row.id),
      sourceId: String(row.source_id),
      sourceProductId: String(row.external_id),
      canonicalUrl: String(row.canonical_url),
      title: String(row.title),
      brand: row.brand ? String(row.brand) : null,
      sku: row.sku ? String(row.sku) : null,
      price: { amount: "0", currency: "EUR" },
      availability: "unknown" as const,
      returnPolicySnapshotId: null,
      extractorVersion: String(row.extractor_version),
      fetchedAt: new Date().toISOString(),
      evidenceUri: null,
      fieldConfidence: {},
    }));

    const orderRows = await this.db.query<Record<string, unknown>>(`SELECT * FROM orders`);
    const lineRows = await this.db.query<Record<string, unknown>>(`SELECT * FROM order_lines`);
    snapshot.orders = orderRows.rows.map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      provider: String(row.provider),
      externalId: String(row.external_id),
      ownershipVerifiedAt: row.ownership_verified_at
        ? new Date(String(row.ownership_verified_at)).toISOString()
        : null,
      piiRef: row.pii_ref ? String(row.pii_ref) : null,
      createdAt: new Date(String(row.created_at)).toISOString(),
      lines: lineRows.rows
        .filter((line) => String(line.order_id) === String(row.id))
        .map((line) => ({
          sku: line.sku ? String(line.sku) : null,
          title: String(line.title),
          quantity: Number(line.quantity),
          amount: String(line.amount),
          currency: String(line.currency),
        })),
    }));

    const policyRows = await this.db.query<Record<string, unknown>>(`SELECT * FROM policy_snapshots`);
    snapshot.policies = policyRows.rows.map((row) => ({
      id: String(row.id),
      sourceId: row.source_id ? String(row.source_id) : "platform",
      version: String(row.version),
      contentHash: String(row.content_hash),
      effectiveAt: new Date(String(row.effective_at)).toISOString(),
      rules: row.rules_json as PlatformSnapshot["policies"][number]["rules"],
      evidenceUri: row.evidence_uri ? String(row.evidence_uri) : null,
    }));

    const caseRows = await this.db.query<Record<string, unknown>>(`SELECT * FROM return_cases`);
    snapshot.cases = caseRows.rows.map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      orderId: String(row.order_id),
      state: row.state as PlatformSnapshot["cases"][number]["state"],
      eligibility: row.eligibility as PlatformSnapshot["cases"][number]["eligibility"],
      policySnapshotId: String(row.policy_snapshot_id),
      version: Number(row.version),
      attestedAt: row.attested_at ? new Date(String(row.attested_at)).toISOString() : null,
      attestedBy: row.attested_by ? (actorById.get(String(row.attested_by)) ?? null) : null,
      ownershipVerifiedAt: null,
    }));

    const approvalRows = await this.db.query<Record<string, unknown>>(`SELECT * FROM approval_requests`);
    snapshot.approvals = approvalRows.rows.map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      caseId: String(row.case_id),
      requestedBy: actorById.get(String(row.requested_by)) ?? String(row.requested_by),
      approvedBy: row.approved_by ? (actorById.get(String(row.approved_by)) ?? null) : null,
      decision: row.decision as PlatformSnapshot["approvals"][number]["decision"],
      reason: String(row.reason),
      policyVersion: String(row.policy_version),
      idempotencyKey: String(row.idempotency_key),
      decidedAt: row.decided_at ? new Date(String(row.decided_at)).toISOString() : null,
    }));

    const actionRows = await this.db.query<Record<string, unknown>>(`SELECT * FROM provider_actions`);
    snapshot.actions = actionRows.rows.map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      caseId: String(row.case_id),
      provider: String(row.provider),
      actionType: String(row.action_type),
      idempotencyKey: String(row.idempotency_key),
      approvalRequestId: String(row.approval_request_id),
      status: row.status as PlatformSnapshot["actions"][number]["status"],
      requestRef: row.request_ref ? String(row.request_ref) : null,
      responseRef: row.response_ref ? String(row.response_ref) : null,
    }));

    const evidenceRows = await this.db.query<Record<string, unknown>>(`SELECT * FROM case_evidence`);
    snapshot.evidence = evidenceRows.rows.map((row) => ({
      id: String(row.id),
      caseId: String(row.case_id),
      objectUri: String(row.object_uri),
      checksum: String(row.checksum),
      classification: String(row.classification),
      expiresAt: row.expires_at ? new Date(String(row.expires_at)).toISOString() : null,
    }));

    for (const item of snapshot.cases) {
      const order = snapshot.orders.find((entry) => entry.id === item.orderId);
      item.ownershipVerifiedAt = order?.ownershipVerifiedAt ?? null;
    }

    const importRows = await this.db.query<Record<string, unknown>>(`SELECT * FROM import_runs`);
    snapshot.imports = importRows.rows.map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      sourceId: String(row.source_id),
      kind: "merchant_export",
      status: row.status as PlatformSnapshot["imports"][number]["status"],
      extractorVersion: String(row.extractor_version),
      idempotencyKey: String(row.idempotency_key),
      productsUpserted: Number(row.products_upserted),
      observationsAppended: Number(row.observations_appended),
      errorClass: (row.error_class as PlatformSnapshot["imports"][number]["errorClass"]) ?? null,
      errorMessage: row.error_message ? String(row.error_message) : null,
      createdAt: new Date(String(row.created_at)).toISOString(),
    }));

    return snapshot;
  }
}

type SourceRecordStatus = PlatformSnapshot["sources"][number]["status"];

function inferRole(subject: string, fallback: Role): Role {
  const found = ROLES.find((role) => subject === role || subject.startsWith(`${role}-`));
  return found ?? fallback;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return [];
}
