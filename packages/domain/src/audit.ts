import { randomUUID } from "node:crypto";
import { AuditImmutabilityError, ValidationError } from "./errors.js";
import { canonicalize, sha256Hex } from "./hash.js";
import type { Actor, AuditEvent, Role } from "./types.js";

export const AUDIT_GENESIS = "GENESIS";

export interface AppendAuditInput {
  id?: string;
  tenantId: string;
  occurredAt?: string;
  actorId: string;
  actorRole: Role;
  action: string;
  entityType: string;
  entityId: string;
  caseId?: string;
  policyVersion?: string;
  providerCorrelationId?: string;
  before?: unknown;
  after: unknown;
  traceId: string;
  payloadRedacted?: Record<string, unknown>;
}

export interface AuditStore {
  latestHash(tenantId: string): string | null;
  insert(event: AuditEvent): void;
}

export function hashPayload(value: unknown): string {
  return sha256Hex(canonicalize(value ?? null));
}

export function computeEventHash(input: {
  tenantId: string;
  occurredAt: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  afterHash: string;
  prevEventHash: string | null;
}): string {
  return sha256Hex(
    canonicalize({
      action: input.action,
      actorId: input.actorId,
      afterHash: input.afterHash,
      entityId: input.entityId,
      entityType: input.entityType,
      occurredAt: input.occurredAt,
      prevEventHash: input.prevEventHash ?? AUDIT_GENESIS,
      tenantId: input.tenantId,
    }),
  );
}

export function verifyChain(events: readonly AuditEvent[]): boolean {
  let prev: string | null = null;
  for (const event of events) {
    if (event.prevEventHash !== prev) {
      return false;
    }
    const expected = computeEventHash({
      tenantId: event.tenantId,
      occurredAt: event.occurredAt,
      actorId: event.actorId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      afterHash: event.afterHash,
      prevEventHash: event.prevEventHash,
    });
    if (expected !== event.eventHash) {
      return false;
    }
    prev = event.eventHash;
  }
  return true;
}

export function assertAuditMutation(operation: "insert" | "update" | "delete"): void {
  if (operation !== "insert") {
    throw new AuditImmutabilityError();
  }
}

function assertNoSensitiveKeys(payload: Record<string, unknown>): void {
  const banned = ["password", "token", "cookie", "secret", "cardNumber", "cvv", "ssn"];
  const keys = Object.keys(payload).map((key) => key.toLowerCase());
  for (const bannedKey of banned) {
    if (keys.some((key) => key.includes(bannedKey.toLowerCase()))) {
      throw new ValidationError(`audit payload must not contain ${bannedKey}`);
    }
  }
}

export class InMemoryAuditAppender {
  constructor(private readonly store: AuditStore) {}

  append(input: AppendAuditInput): AuditEvent {
    if (!input.traceId) {
      throw new ValidationError("trace_id is required");
    }
    const payload = input.payloadRedacted ?? {};
    assertNoSensitiveKeys(payload);

    const occurredAt = input.occurredAt ?? new Date().toISOString();
    const prevEventHash = this.store.latestHash(input.tenantId);
    const afterHash = hashPayload(input.after);
    const beforeHash = input.before === undefined ? undefined : hashPayload(input.before);
    const eventHash = computeEventHash({
      tenantId: input.tenantId,
      occurredAt,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      afterHash,
      prevEventHash,
    });

    const event: AuditEvent = {
      id: input.id ?? randomUUID(),
      tenantId: input.tenantId,
      occurredAt,
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      afterHash,
      prevEventHash,
      eventHash,
      traceId: input.traceId,
      payloadRedacted: payload,
    };
    if (input.caseId) event.caseId = input.caseId;
    if (input.policyVersion) event.policyVersion = input.policyVersion;
    if (input.providerCorrelationId) event.providerCorrelationId = input.providerCorrelationId;
    if (beforeHash) event.beforeHash = beforeHash;

    assertAuditMutation("insert");
    this.store.insert(event);
    return event;
  }
}

export class MemoryAuditStore implements AuditStore {
  readonly events: AuditEvent[] = [];

  latestHash(tenantId: string): string | null {
    for (let index = this.events.length - 1; index >= 0; index -= 1) {
      const event = this.events[index];
      if (event && event.tenantId === tenantId) {
        return event.eventHash;
      }
    }
    return null;
  }

  insert(event: AuditEvent): void {
    this.events.push(event);
  }

  update(): never {
    throw new AuditImmutabilityError();
  }

  delete(): never {
    throw new AuditImmutabilityError();
  }
}

export function actorFrom(actor: Actor): Pick<AppendAuditInput, "actorId" | "actorRole" | "tenantId"> {
  return { actorId: actor.id, actorRole: actor.role, tenantId: actor.tenantId };
}
