import { randomUUID } from "node:crypto";
import type { PlatformSnapshot } from "@refund/persist";
import {
  ALIEXPRESS_UA_SOURCE,
  SHOPIFY_MERCHANT_SOURCE,
  DomainError,
  IdempotencyStore,
  InMemoryAuditAppender,
  MemoryAuditStore,
  MemoryOutbox,
  NotFoundError,
  RateLimitError,
  SlidingWindowLimiter,
  ValidationError,
  applyEligibility,
  assertImportAllowed,
  assertPermission,
  assertSameTenant,
  attestCase,
  canStartImport,
  classifyImportFailure,
  createDraftCase,
  createDraftSource,
  createEvidenceRecord,
  createOutboxEvent,
  createPolicySnapshot,
  createProviderAction,
  decideApproval,
  eraseCaseArtifacts,
  evaluateEligibility,
  markOutboxFailed,
  markOutboxPublished,
  mergeProducts,
  parseMerchantExport,
  placeLegalHold,
  reconcileProviderAction,
  requestApproval,
  transitionCase,
  transitionSource,
  type Actor,
  type ApprovalRequest,
  type CaseEvidence,
  type CaseState,
  type EligibilityFacts,
  type ImportRun,
  type NormalizedProduct,
  type OrderLine,
  type OrderRecord,
  type OutboxEvent,
  type PolicySnapshot,
  type ProductObservation,
  type ProviderAction,
  type ProviderActionStatus,
  type ReturnCase,
  type SourceRecord,
} from "@refund/domain";
import type { ObjectStore } from "@refund/persist";

export class Platform {
  readonly auditStore = new MemoryAuditStore();
  private readonly audit = new InMemoryAuditAppender(this.auditStore);
  private readonly sources = new Map<string, SourceRecord>();
  private readonly products = new Map<string, NormalizedProduct>();
  private readonly observations: ProductObservation[] = [];
  private readonly policies = new Map<string, PolicySnapshot>();
  private readonly orders = new Map<string, OrderRecord>();
  private readonly cases = new Map<string, ReturnCase>();
  private readonly approvals = new Map<string, ApprovalRequest>();
  private readonly actions = new Map<string, ProviderAction>();
  private readonly evidence: CaseEvidence[] = [];
  private readonly imports = new Map<string, ImportRun>();
  private readonly importKeys = new IdempotencyStore<ImportRun>();
  private readonly orderKeys = new IdempotencyStore<OrderRecord>();
  private readonly submitKeys = new IdempotencyStore<ProviderAction>();
  private readonly seenActors = new Map<string, Actor>();
  private readonly outbox = new MemoryOutbox();
  private readonly limiter = new SlidingWindowLimiter();
  private objectStore: ObjectStore | null = null;

  bindObjectStore(store: ObjectStore): void {
    this.objectStore = store;
  }

  constructor() {
    this.sources.set(ALIEXPRESS_UA_SOURCE.id, { ...ALIEXPRESS_UA_SOURCE });
    this.sources.set(ALIEXPRESS_UA_SOURCE.slug, { ...ALIEXPRESS_UA_SOURCE });
    this.sources.set(SHOPIFY_MERCHANT_SOURCE.id, { ...SHOPIFY_MERCHANT_SOURCE });
    this.sources.set(SHOPIFY_MERCHANT_SOURCE.slug, { ...SHOPIFY_MERCHANT_SOURCE });
  }

  static fromSnapshot(snapshot: PlatformSnapshot): Platform {
    const platform = new Platform();
    platform.importSnapshot(snapshot);
    return platform;
  }

  exportSnapshot(): PlatformSnapshot {
    return {
      actors: [...this.seenActors.values()],
      sources: this.uniqueSources(),
      products: [...this.products.values()],
      observations: [...this.observations],
      policies: [...this.policies.values()],
      orders: [...this.orders.values()],
      cases: [...this.cases.values()],
      approvals: [...this.approvals.values()],
      actions: [...this.actions.values()],
      evidence: [...this.evidence],
      imports: [...this.imports.values()],
      audit: [...this.auditStore.events],
      outbox: this.outbox.list(),
    };
  }

  importSnapshot(snapshot: PlatformSnapshot): void {
    this.sources.clear();
    this.products.clear();
    this.observations.splice(0, this.observations.length);
    this.policies.clear();
    this.orders.clear();
    this.cases.clear();
    this.approvals.clear();
    this.actions.clear();
    this.evidence.splice(0, this.evidence.length);
    this.imports.clear();
    this.seenActors.clear();
    this.outbox.clear();
    this.auditStore.events.splice(0, this.auditStore.events.length);

    for (const source of snapshot.sources) this.putSource(source);
    if (!this.sources.has(ALIEXPRESS_UA_SOURCE.slug)) {
      this.putSource({ ...ALIEXPRESS_UA_SOURCE });
    }
    if (!this.sources.has(SHOPIFY_MERCHANT_SOURCE.slug)) {
      this.putSource({ ...SHOPIFY_MERCHANT_SOURCE });
    }
    for (const product of snapshot.products) {
      this.products.set(`${product.sourceId}:${product.sourceProductId}`, product);
    }
    this.observations.push(...snapshot.observations);
    for (const policy of snapshot.policies) this.policies.set(policy.id, policy);
    for (const order of snapshot.orders) {
      this.orders.set(order.id, order);
      this.orderKeys.remember(order.tenantId, `hydrated-order-${order.id}`, order);
    }
    for (const item of snapshot.cases) this.cases.set(item.id, item);
    for (const item of snapshot.approvals) this.approvals.set(item.id, item);
    for (const item of snapshot.actions) {
      this.actions.set(item.id, item);
      this.submitKeys.remember(item.tenantId, item.idempotencyKey, item);
    }
    this.evidence.push(
      ...snapshot.evidence.map((item) => ({
        ...item,
        legalHold: Boolean(item.legalHold),
        erasedAt: item.erasedAt ?? null,
      })),
    );
    this.outbox.load(snapshot.outbox ?? []);
    for (const item of snapshot.imports) {
      this.imports.set(item.id, item);
      this.importKeys.remember(item.tenantId, item.idempotencyKey, item);
    }
    for (const actor of snapshot.actors) {
      this.seenActors.set(`${actor.tenantId}:${actor.id}`, actor);
    }
    this.auditStore.events.push(...snapshot.audit);
  }

  private rememberActor(actor: Actor): void {
    this.seenActors.set(`${actor.tenantId}:${actor.id}`, actor);
  }

  private enqueueOutbox(
    actor: Actor,
    input: {
      aggregateType: string;
      aggregateId: string;
      eventType: string;
      payload: Record<string, unknown>;
      idempotencyKey: string;
    },
  ): OutboxEvent {
    return this.outbox.enqueue(
      createOutboxEvent({
        tenantId: actor.tenantId,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        payload: input.payload,
        idempotencyKey: input.idempotencyKey,
      }),
    );
  }

  private record(
    actor: Actor,
    action: string,
    entityType: string,
    entityId: string,
    after: unknown,
    extra: { caseId?: string; policyVersion?: string; traceId: string },
  ): void {
    this.rememberActor(actor);
    this.audit.append({
      tenantId: actor.tenantId,
      actorId: actor.id,
      actorRole: actor.role,
      action,
      entityType,
      entityId,
      after,
      traceId: extra.traceId,
      payloadRedacted: { action, entityType },
      caseId: extra.caseId,
      policyVersion: extra.policyVersion,
    });
  }

  createSource(
    actor: Actor,
    input: {
      slug: string;
      owner: string;
      baseUrl: string;
      permissionBasis: string;
      policyUrl: string;
      rateLimitPerMinute: number;
      allowedFields: string[];
      retentionDays: number;
      regionNotes?: string;
    },
    traceId: string,
  ): SourceRecord {
    assertPermission(actor, "sources:create");
    if (this.sources.has(input.slug)) {
      throw new ValidationError(`source ${input.slug} already exists`);
    }
    const source = createDraftSource({
      id: randomUUID(),
      tenantId: actor.tenantId,
      slug: input.slug,
      owner: input.owner,
      baseUrl: input.baseUrl,
      permissionBasis: input.permissionBasis,
      policyUrl: input.policyUrl,
      rateLimitPerMinute: input.rateLimitPerMinute,
      allowedFields: input.allowedFields,
      retentionDays: input.retentionDays,
      regionNotes: input.regionNotes ?? "",
    });
    this.putSource(source);
    this.record(actor, "source.created", "source", source.id, { slug: source.slug, status: source.status }, { traceId });
    return source;
  }

  listSources(actor: Actor): SourceRecord[] {
    assertPermission(actor, "sources:read");
    const seen = new Set<string>();
    const list: SourceRecord[] = [];
    for (const source of this.sources.values()) {
      if (seen.has(source.id)) continue;
      seen.add(source.id);
      list.push(source);
    }
    return list;
  }

  getSource(idOrSlug: string): SourceRecord {
    const source = this.sources.get(idOrSlug);
    if (!source) throw new NotFoundError(`source ${idOrSlug} not found`);
    return source;
  }

  reviewSource(actor: Actor, id: string, traceId: string): SourceRecord {
    const next = transitionSource(actor, this.getSource(id), "review");
    this.putSource(next);
    this.record(actor, "source.reviewed", "source", next.id, { status: next.status }, { traceId });
    return next;
  }

  approveSource(actor: Actor, id: string, traceId: string): SourceRecord {
    const next = transitionSource(actor, this.getSource(id), "approved");
    this.putSource(next);
    this.record(actor, "source.approved", "source", next.id, { status: next.status }, { traceId });
    return next;
  }

  importMerchantExport(
    actor: Actor,
    input: { sourceId: string; document: unknown; idempotencyKey: string },
    traceId: string,
  ): ImportRun {
    assertPermission(actor, "import:start");
    const existing = this.importKeys.get(actor.tenantId, input.idempotencyKey);
    if (existing) return existing;
    const source = this.getSource(input.sourceId);
    this.limiter.acquireOrThrow(source.id, source.rateLimitPerMinute, Date.now(), source.slug);
    const now = new Date().toISOString();
    try {
      assertImportAllowed(source);
      const parsed = parseMerchantExport(source, input.document, now);
      if (!parsed.ok && parsed.products.length === 0) {
        const run: ImportRun = {
          id: randomUUID(),
          tenantId: actor.tenantId,
          sourceId: source.id,
          kind: "merchant_export",
          status: "failed",
          extractorVersion: parsed.extractorVersion,
          idempotencyKey: input.idempotencyKey,
          productsUpserted: 0,
          observationsAppended: 0,
          errorClass: "non_retryable",
          errorMessage: parsed.issues.map((issue) => issue.message).join("; "),
          createdAt: now,
        };
        return this.saveImport(actor, run, { traceId, after: { status: run.status } });
      }
      let upserts = 0;
      for (const product of parsed.products) {
        const key = `${product.sourceId}:${product.sourceProductId}`;
        const merged = mergeProducts(this.products.get(key), product);
        this.products.set(key, merged.product);
        upserts += 1;
      }
      this.observations.push(...parsed.observations);
      const run: ImportRun = {
        id: randomUUID(),
        tenantId: actor.tenantId,
        sourceId: source.id,
        kind: "merchant_export",
        status: parsed.ok ? "succeeded" : "failed",
        extractorVersion: parsed.extractorVersion,
        idempotencyKey: input.idempotencyKey,
        productsUpserted: upserts,
        observationsAppended: parsed.observations.length,
        errorClass: parsed.ok ? null : "non_retryable",
        errorMessage: parsed.ok ? null : parsed.issues.map((issue) => issue.message).join("; "),
        createdAt: now,
      };
      return this.saveImport(actor, run, { traceId, after: { status: run.status, upserts } });
    } catch (error) {
      if (error instanceof RateLimitError) throw error;
      const classified = classifyImportFailure(source, error);
      const run: ImportRun = {
        id: randomUUID(),
        tenantId: actor.tenantId,
        sourceId: source.id,
        kind: "merchant_export",
        status: classified.status,
        extractorVersion: "merchant-export@1.0.0",
        idempotencyKey: input.idempotencyKey,
        productsUpserted: 0,
        observationsAppended: 0,
        errorClass: classified.errorClass,
        errorMessage: classified.errorMessage,
        createdAt: now,
      };
      return this.saveImport(actor, run, { traceId, after: { status: run.status } });
    }
  }

  searchProducts(actor: Actor, sourceId: string | undefined, q: string | undefined): NormalizedProduct[] {
    assertPermission(actor, "sources:read");
    const query = (q ?? "").toLowerCase();
    return [...this.products.values()].filter((product) => {
      if (sourceId && product.sourceId !== sourceId && this.getSource(sourceId).id !== product.sourceId) {
        return false;
      }
      if (!query) return true;
      return (
        product.title.toLowerCase().includes(query) ||
        (product.sku ?? "").toLowerCase().includes(query) ||
        product.sourceProductId.toLowerCase().includes(query)
      );
    });
  }

  importOrder(
    actor: Actor,
    input: {
      provider: string;
      externalId: string;
      ownershipVerifiedAt: string | null;
      piiRef?: string | null;
      lines: OrderLine[];
      idempotencyKey: string;
    },
    traceId: string,
  ): OrderRecord {
    assertPermission(actor, "orders:import");
    const existing = this.orderKeys.get(actor.tenantId, input.idempotencyKey);
    if (existing) return existing;
    if (!input.externalId || !input.provider) {
      throw new ValidationError("provider and external_id are required");
    }
    if (!input.lines.length) {
      throw new ValidationError("order must contain at least one line");
    }
    const order: OrderRecord = {
      id: randomUUID(),
      tenantId: actor.tenantId,
      provider: input.provider,
      externalId: input.externalId,
      ownershipVerifiedAt: input.ownershipVerifiedAt,
      piiRef: input.piiRef ?? null,
      lines: input.lines,
      createdAt: new Date().toISOString(),
      erasedAt: null,
    };
    this.orders.set(order.id, order);
    this.orderKeys.remember(actor.tenantId, input.idempotencyKey, order);
    this.record(
      actor,
      "order.imported",
      "order",
      order.id,
      { provider: order.provider, externalId: order.externalId },
      { traceId },
    );
    return order;
  }

  getOrder(actor: Actor, id: string): OrderRecord {
    assertPermission(actor, "orders:read");
    const order = this.orders.get(id);
    if (!order) throw new NotFoundError(`order ${id} not found`);
    assertSameTenant(actor, order.tenantId);
    return order;
  }

  createCase(
    actor: Actor,
    input: { orderId: string; policy?: Parameters<typeof createPolicySnapshot>[0]["rules"] },
    traceId: string,
  ): ReturnCase {
    assertPermission(actor, "cases:create");
    const order = this.getOrder(actor, input.orderId);
    const policy = createPolicySnapshot({
      id: randomUUID(),
      sourceId: "merchant-self-export",
      effectiveAt: new Date().toISOString(),
      rules: input.policy ?? {
        version: "default-merchant-2026-08",
        returnWindowDays: 14,
        allowedRegions: ["UA", "EU"],
        allowedConditions: ["unused", "defective", "not_as_described", "not_received"],
        excludedCategories: ["digital"],
        buyerPaysReturnShipping: true,
        methods: ["refund"],
      },
    });
    this.policies.set(policy.id, policy);
    const created = createDraftCase({
      id: randomUUID(),
      tenantId: actor.tenantId,
      orderId: order.id,
      policySnapshotId: policy.id,
      ownershipVerifiedAt: order.ownershipVerifiedAt,
    });
    this.cases.set(created.id, created);
    this.record(actor, "case.created", "return_case", created.id, { state: created.state }, { traceId, caseId: created.id });
    return created;
  }

  getCase(actor: Actor, id: string): ReturnCase {
    assertPermission(actor, "cases:read");
    const current = this.cases.get(id);
    if (!current) throw new NotFoundError(`case ${id} not found`);
    assertSameTenant(actor, current.tenantId);
    return current;
  }

  evaluateCase(actor: Actor, id: string, facts: EligibilityFacts, traceId: string): ReturnCase {
    assertPermission(actor, "eligibility:recalculate");
    const current = this.getCase(actor, id);
    const policy = this.policies.get(current.policySnapshotId);
    if (!policy) throw new NotFoundError("policy snapshot not found");
    const evaluation = evaluateEligibility(policy, facts);
    const next = applyEligibility(current, evaluation);
    this.cases.set(next.id, next);
    this.record(
      actor,
      "case.eligibility",
      "return_case",
      next.id,
      { result: evaluation.result, missing: evaluation.missingFields },
      { traceId, caseId: next.id, policyVersion: evaluation.policyVersion },
    );
    return next;
  }

  attest(actor: Actor, id: string, traceId: string): ReturnCase {
    const next = attestCase(actor, this.getCase(actor, id), new Date().toISOString());
    this.cases.set(next.id, next);
    this.record(actor, "case.attested", "return_case", next.id, { attestedBy: actor.id }, { traceId, caseId: next.id });
    return next;
  }

  addEvidence(
    actor: Actor,
    id: string,
    input: { objectUri: string; checksum: string; classification: string; expiresAt?: string | null },
    traceId: string,
  ): CaseEvidence {
    const current = this.getCase(actor, id);
    assertPermission(actor, "cases:update");
    const item = createEvidenceRecord({
      id: randomUUID(),
      caseId: current.id,
      objectUri: input.objectUri,
      checksum: input.checksum,
      classification: input.classification,
      expiresAt: input.expiresAt ?? null,
    });
    this.evidence.push(item);
    this.record(actor, "case.evidence_added", "case_evidence", item.id, { classification: item.classification }, { traceId, caseId: current.id });
    return item;
  }

  requestCaseApproval(actor: Actor, id: string, reason: string, idempotencyKey: string, traceId: string): ApprovalRequest {
    let current = this.getCase(actor, id);
    if (current.state === "draft" || current.state === "evidence_pending") {
      current = transitionCase(actor, current, "submitted_for_approval", current.version);
      this.cases.set(current.id, current);
    }
    const approval = requestApproval({
      actor,
      caseRecord: current,
      reason,
      idempotencyKey,
      policyVersion: this.policies.get(current.policySnapshotId)?.version ?? current.policySnapshotId,
    });
    this.approvals.set(approval.id, approval);
    this.record(
      actor,
      "approval.requested",
      "approval_request",
      approval.id,
      { decision: approval.decision },
      { traceId, caseId: current.id, policyVersion: approval.policyVersion },
    );
    return approval;
  }

  decideCaseApproval(
    actor: Actor,
    caseId: string,
    approvalId: string,
    decision: "approved" | "rejected",
    reason: string,
    traceId: string,
  ): ApprovalRequest {
    const current = this.getCase(actor, caseId);
    const request = this.approvals.get(approvalId);
    if (!request || request.caseId !== current.id) {
      throw new NotFoundError("approval request not found");
    }
    const decided = decideApproval({
      actor,
      request,
      decision,
      reason,
      decidedAt: new Date().toISOString(),
    });
    this.approvals.set(decided.id, decided);
    if (decided.decision === "approved") {
      const next = transitionCase(actor, current, "approved_for_submission", current.version);
      this.cases.set(next.id, next);
    }
    this.record(
      actor,
      "approval.decided",
      "approval_request",
      decided.id,
      { decision: decided.decision },
      { traceId, caseId: current.id, policyVersion: decided.policyVersion },
    );
    return decided;
  }

  submitCase(
    actor: Actor,
    id: string,
    input: { idempotencyKey: string; provider: string; actionType: string },
    traceId: string,
  ): { case: ReturnCase; action: ProviderAction } {
    const existing = this.submitKeys.get(actor.tenantId, input.idempotencyKey);
    if (existing) {
      return { case: this.getCase(actor, id), action: existing };
    }
    const current = this.getCase(actor, id);
    const approval = [...this.approvals.values()].find(
      (item) => item.caseId === current.id && item.decision === "approved",
    );
    if (!approval) {
      throw new ValidationError("no approved request for this case");
    }
    const source = [...this.uniqueSources()].find((item) => item.slug === input.provider);
    const action = createProviderAction({
      actor,
      caseRecord: current,
      approval,
      source,
      provider: input.provider,
      actionType: input.actionType,
      idempotencyKey: input.idempotencyKey,
    });
    const submitted = transitionCase(actor, current, "submitted", current.version);
    this.cases.set(submitted.id, submitted);
    this.actions.set(action.id, action);
    this.submitKeys.remember(actor.tenantId, input.idempotencyKey, action);
    this.enqueueOutbox(actor, {
      aggregateType: "provider_action",
      aggregateId: action.id,
      eventType: "case.submitted",
      payload: {
        caseId: submitted.id,
        actionType: action.actionType,
        provider: action.provider,
        status: action.status,
      },
      idempotencyKey: `outbox-submit-${input.idempotencyKey}`.slice(0, 128),
    });
    this.record(
      actor,
      "provider_action.queued",
      "provider_action",
      action.id,
      { status: action.status, actionType: action.actionType },
      { traceId, caseId: submitted.id },
    );
    return { case: submitted, action };
  }

  advanceCase(actor: Actor, id: string, nextState: CaseState, expectedVersion: number, traceId: string): ReturnCase {
    const current = this.getCase(actor, id);
    const next = transitionCase(actor, current, nextState, expectedVersion);
    this.cases.set(next.id, next);
    this.enqueueOutbox(actor, {
      aggregateType: "return_case",
      aggregateId: next.id,
      eventType: "case.transitioned",
      payload: { from: current.state, to: next.state, version: next.version },
      idempotencyKey: `outbox-case-${next.id}-${next.version}`.replace(/[^A-Za-z0-9:_-]/g, "").padEnd(16, "x"),
    });
    this.record(
      actor,
      "case.transitioned",
      "return_case",
      next.id,
      { state: next.state, version: next.version },
      { traceId, caseId: next.id },
    );
    return next;
  }

  listEvidence(actor: Actor, caseId: string): CaseEvidence[] {
    this.getCase(actor, caseId);
    return this.evidence.filter((item) => item.caseId === caseId);
  }

  listActions(actor: Actor, caseId: string): ProviderAction[] {
    this.getCase(actor, caseId);
    return [...this.actions.values()].filter((item) => item.caseId === caseId);
  }

  setEvidenceHold(actor: Actor, caseId: string, evidenceId: string, legalHold: boolean, traceId: string): CaseEvidence {
    this.getCase(actor, caseId);
    if (actor.role === "customer") {
      throw new ValidationError("customer cannot place a legal hold");
    }
    if (actor.role !== "compliance_admin") {
      assertPermission(actor, "cases:update");
    }
    const index = this.evidence.findIndex((item) => item.id === evidenceId && item.caseId === caseId);
    if (index < 0) throw new NotFoundError("evidence not found");
    const next = placeLegalHold(this.evidence[index] as CaseEvidence, legalHold);
    this.evidence[index] = next;
    this.record(
      actor,
      "case.evidence_hold",
      "case_evidence",
      next.id,
      { legalHold: next.legalHold },
      { traceId, caseId },
    );
    return next;
  }

  eraseCasePii(actor: Actor, caseId: string, reason: string, traceId: string): {
    order: OrderRecord;
    evidence: CaseEvidence[];
    redactedFields: string[];
  } {
    const current = this.getCase(actor, caseId);
    const order = this.getOrder(actor, current.orderId);
    const related = this.evidence.filter((item) => item.caseId === current.id);
    const result = eraseCaseArtifacts({
      actor,
      tenantId: current.tenantId,
      order,
      evidence: related,
      reason,
      erasedAt: new Date().toISOString(),
    });
    this.orders.set(result.order.id, result.order);
    for (const item of result.evidence) {
      const index = this.evidence.findIndex((row) => row.id === item.id);
      if (index >= 0) this.evidence[index] = item;
      if (this.objectStore && item.objectUri === "erased://redacted") {
        const previous = related.find((row) => row.id === item.id);
        if (previous && previous.objectUri !== item.objectUri) {
          void this.objectStore.erase(previous.objectUri);
        }
      }
    }
    this.enqueueOutbox(actor, {
      aggregateType: "return_case",
      aggregateId: current.id,
      eventType: "erasure.completed",
      payload: { caseId: current.id, orderId: order.id, fields: result.redactedFields.length },
      idempotencyKey: `outbox-erase-${current.id}`.padEnd(16, "x"),
    });
    this.record(
      actor,
      "privacy.erased",
      "return_case",
      current.id,
      { fields: result.redactedFields.length },
      { traceId, caseId: current.id },
    );
    return result;
  }

  suspendSource(actor: Actor, id: string, traceId: string): SourceRecord {
    const next = transitionSource(actor, this.getSource(id), "suspended");
    this.putSource(next);
    this.enqueueOutbox(actor, {
      aggregateType: "source",
      aggregateId: next.id,
      eventType: "source.suspended",
      payload: { slug: next.slug, status: next.status },
      idempotencyKey: `outbox-suspend-${next.id}`.padEnd(16, "x"),
    });
    this.record(actor, "source.suspended", "source", next.id, { status: next.status }, { traceId });
    return next;
  }

  reconcileAction(
    actor: Actor,
    actionId: string,
    input: { status: ProviderActionStatus; correlationId: string; note: string },
    traceId: string,
  ): ProviderAction {
    const current = this.actions.get(actionId);
    if (!current) throw new NotFoundError(`provider action ${actionId} not found`);
    const next = reconcileProviderAction({
      actor,
      action: current,
      nextStatus: input.status,
      correlationId: input.correlationId,
      note: input.note,
    });
    this.actions.set(next.id, next);
    this.enqueueOutbox(actor, {
      aggregateType: "provider_action",
      aggregateId: next.id,
      eventType: "provider_action.reconciled",
      payload: { status: next.status, caseId: next.caseId },
      idempotencyKey: `outbox-recon-${next.id}-${next.status}`.padEnd(16, "x"),
    });
    this.record(
      actor,
      "provider_action.reconciled",
      "provider_action",
      next.id,
      { status: next.status },
      { traceId, caseId: next.caseId },
    );
    return next;
  }

  listOutbox(actor: Actor): OutboxEvent[] {
    assertPermission(actor, "outbox:read");
    return this.outbox.list(actor.tenantId);
  }

  publishOutbox(actor: Actor, limit = 20): { published: number; items: OutboxEvent[] } {
    assertPermission(actor, "outbox:publish");
    const now = new Date().toISOString();
    const items: OutboxEvent[] = [];
    for (const event of this.outbox.unpublished(actor.tenantId).slice(0, limit)) {
      try {
        const published = markOutboxPublished(event, now);
        this.outbox.replace(published);
        items.push(published);
      } catch (error) {
        this.outbox.replace(markOutboxFailed(event, (error as Error).message));
      }
    }
    this.record(actor, "outbox.published", "outbox", actor.tenantId, { published: items.length }, { traceId: "outbox" });
    return { published: items.length, items };
  }

  listAudit(actor: Actor, caseId: string | undefined): unknown[] {
    assertPermission(actor, "audit:read");
    return this.auditStore.events
      .filter((event) => event.tenantId === actor.tenantId)
      .filter((event) => !caseId || event.caseId === caseId)
      .map((event) => {
        if (actor.role === "auditor" || actor.role === "approver") {
          return event;
        }
        return {
          id: event.id,
          occurredAt: event.occurredAt,
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId,
          caseId: event.caseId,
          traceId: event.traceId,
        };
      });
  }

  listOrders(actor: Actor): OrderRecord[] {
    assertPermission(actor, "orders:read");
    return [...this.orders.values()].filter((order) => order.tenantId === actor.tenantId);
  }

  listCases(actor: Actor): ReturnCase[] {
    assertPermission(actor, "cases:read");
    return [...this.cases.values()].filter((item) => item.tenantId === actor.tenantId);
  }

  listApprovals(actor: Actor, caseId: string): ApprovalRequest[] {
    this.getCase(actor, caseId);
    return [...this.approvals.values()].filter((item) => item.caseId === caseId);
  }

  listImports(actor: Actor): ImportRun[] {
    assertPermission(actor, "import:start");
    return [...this.imports.values()].filter((item) => item.tenantId === actor.tenantId);
  }

  sourceImportAllowed(idOrSlug: string): boolean {
    return canStartImport(this.getSource(idOrSlug));
  }

  isDomainError(error: unknown): error is DomainError {
    return error instanceof DomainError;
  }

  private putSource(source: SourceRecord): void {
    this.sources.set(source.id, source);
    this.sources.set(source.slug, source);
  }

  private uniqueSources(): SourceRecord[] {
    const seen = new Set<string>();
    const list: SourceRecord[] = [];
    for (const source of this.sources.values()) {
      if (seen.has(source.id)) continue;
      seen.add(source.id);
      list.push(source);
    }
    return list;
  }

  private saveImport(
    actor: Actor,
    run: ImportRun,
    extra: { traceId: string; after: unknown },
  ): ImportRun {
    this.imports.set(run.id, run);
    this.importKeys.remember(actor.tenantId, run.idempotencyKey, run);
    this.enqueueOutbox(actor, {
      aggregateType: "import_run",
      aggregateId: run.id,
      eventType: "import.finished",
      payload: { status: run.status, sourceId: run.sourceId, products: run.productsUpserted },
      idempotencyKey: `outbox-import-${run.idempotencyKey}`.slice(0, 128),
    });
    this.record(actor, "import.finished", "import_run", run.id, extra.after, { traceId: extra.traceId });
    return run;
  }
}
