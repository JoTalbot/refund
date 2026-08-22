import { randomUUID } from "node:crypto";
import { assertIdempotencyKey } from "./idempotency.js";
import { ValidationError } from "./errors.js";
import type { OutboxEvent } from "./types.js";

export function createOutboxEvent(input: {
  tenantId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  createdAt?: string;
}): OutboxEvent {
  if (!input.tenantId) {
    throw new ValidationError("outbox tenant is required");
  }
  if (!input.eventType || !input.aggregateType || !input.aggregateId) {
    throw new ValidationError("outbox aggregate and event type are required");
  }
  return {
    id: randomUUID(),
    tenantId: input.tenantId,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    eventType: input.eventType,
    payload: redactOutboxPayload(input.payload),
    createdAt: input.createdAt ?? new Date().toISOString(),
    publishedAt: null,
    publishedAttempts: 0,
    lastError: null,
    idempotencyKey: assertIdempotencyKey(input.idempotencyKey),
  };
}

export function markOutboxPublished(event: OutboxEvent, publishedAt: string): OutboxEvent {
  return {
    ...event,
    publishedAt,
    publishedAttempts: event.publishedAttempts + 1,
    lastError: null,
  };
}

export function markOutboxFailed(event: OutboxEvent, error: string): OutboxEvent {
  return {
    ...event,
    publishedAttempts: event.publishedAttempts + 1,
    lastError: error.slice(0, 500),
  };
}

export function unpublishedOutbox(events: readonly OutboxEvent[]): OutboxEvent[] {
  return events.filter((event) => event.publishedAt === null);
}

const FORBIDDEN_KEYS = /password|secret|token|authorization|cookie|dsn|database_url|private_key/i;

export function redactOutboxPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (FORBIDDEN_KEYS.test(key)) continue;
    if (typeof value === "string" && FORBIDDEN_KEYS.test(value)) continue;
    out[key] = value;
  }
  return out;
}

export class MemoryOutbox {
  private readonly events = new Map<string, OutboxEvent>();
  private readonly keys = new Map<string, string>();

  enqueue(event: OutboxEvent): OutboxEvent {
    const existingId = this.keys.get(`${event.tenantId}:${event.idempotencyKey}`);
    if (existingId) {
      const existing = this.events.get(existingId);
      if (existing) return existing;
    }
    this.events.set(event.id, event);
    this.keys.set(`${event.tenantId}:${event.idempotencyKey}`, event.id);
    return event;
  }

  list(tenantId?: string): OutboxEvent[] {
    return [...this.events.values()].filter((event) => !tenantId || event.tenantId === tenantId);
  }

  unpublished(tenantId?: string): OutboxEvent[] {
    return unpublishedOutbox(this.list(tenantId));
  }

  replace(event: OutboxEvent): void {
    this.events.set(event.id, event);
    this.keys.set(`${event.tenantId}:${event.idempotencyKey}`, event.id);
  }

  clear(): void {
    this.events.clear();
    this.keys.clear();
  }

  load(events: readonly OutboxEvent[]): void {
    this.clear();
    for (const event of events) this.replace(event);
  }
}
