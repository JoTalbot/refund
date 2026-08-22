import { describe, expect, it } from "vitest";
import {
  AUDIT_GENESIS,
  InMemoryAuditAppender,
  MemoryAuditStore,
  assertAuditMutation,
  computeEventHash,
  hashPayload,
  verifyChain,
} from "../src/audit.js";
import { AuditImmutabilityError, ValidationError } from "../src/errors.js";

describe("audit contract", () => {
  it("appends a tenant-scoped hash chain", () => {
    const store = new MemoryAuditStore();
    const appender = new InMemoryAuditAppender(store);

    const first = appender.append({
      tenantId: "t1",
      actorId: "operator-1",
      actorRole: "operator",
      action: "case.created",
      entityType: "return_case",
      entityId: "c1",
      after: { state: "draft" },
      traceId: "trace-1",
      payloadRedacted: { state: "draft" },
    });
    const second = appender.append({
      tenantId: "t1",
      actorId: "approver-1",
      actorRole: "approver",
      action: "approval.decided",
      entityType: "approval_request",
      entityId: "a1",
      caseId: "c1",
      after: { decision: "approved" },
      traceId: "trace-2",
    });

    expect(first.prevEventHash).toBeNull();
    expect(second.prevEventHash).toBe(first.eventHash);
    expect(
      computeEventHash({
        tenantId: first.tenantId,
        occurredAt: first.occurredAt,
        actorId: first.actorId,
        action: first.action,
        entityType: first.entityType,
        entityId: first.entityId,
        afterHash: first.afterHash,
        prevEventHash: first.prevEventHash,
      }),
    ).toBe(first.eventHash);
    expect(verifyChain(store.events)).toBe(true);
    expect(first.afterHash).toBe(hashPayload({ state: "draft" }));
  });

  it("isolates hash chains by tenant", () => {
    const store = new MemoryAuditStore();
    const appender = new InMemoryAuditAppender(store);
    const a = appender.append({
      tenantId: "alpha",
      actorId: "a",
      actorRole: "auditor",
      action: "audit.read",
      entityType: "return_case",
      entityId: "1",
      after: { ok: true },
      traceId: "t-a",
    });
    const b = appender.append({
      tenantId: "beta",
      actorId: "b",
      actorRole: "auditor",
      action: "audit.read",
      entityType: "return_case",
      entityId: "2",
      after: { ok: true },
      traceId: "t-b",
    });
    expect(a.prevEventHash).toBeNull();
    expect(b.prevEventHash).toBeNull();
  });

  it("rejects updates, deletes and secrets in the payload", () => {
    expect(() => assertAuditMutation("update")).toThrow(AuditImmutabilityError);
    expect(() => assertAuditMutation("delete")).toThrow(AuditImmutabilityError);
    const store = new MemoryAuditStore();
    expect(() => store.update()).toThrow(AuditImmutabilityError);
    expect(() => store.delete()).toThrow(AuditImmutabilityError);
    const appender = new InMemoryAuditAppender(store);
    expect(() =>
      appender.append({
        tenantId: "t1",
        actorId: "a",
        actorRole: "operator",
        action: "bad",
        entityType: "x",
        entityId: "y",
        after: {},
        traceId: "t",
        payloadRedacted: { accessToken: "secret" },
      }),
    ).toThrow(ValidationError);
  });

  it("detects a broken chain", () => {
    const store = new MemoryAuditStore();
    const appender = new InMemoryAuditAppender(store);
    appender.append({
      tenantId: "t1",
      actorId: "a",
      actorRole: "operator",
      action: "one",
      entityType: "x",
      entityId: "1",
      after: { n: 1 },
      traceId: "t",
    });
    appender.append({
      tenantId: "t1",
      actorId: "a",
      actorRole: "operator",
      action: "two",
      entityType: "x",
      entityId: "2",
      after: { n: 2 },
      traceId: "t",
    });
    const mutated = store.events.map((event, index) =>
      index === 1 ? { ...event, action: "tampered" } : event,
    );
    expect(verifyChain(mutated)).toBe(false);
    expect(AUDIT_GENESIS).toBe("GENESIS");
  });
});
