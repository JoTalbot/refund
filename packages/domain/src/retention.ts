import { ForbiddenError, ValidationError } from "./errors.js";
import { assertPermission, assertSameTenant } from "./rbac.js";
import type { Actor, CaseEvidence, OrderRecord } from "./types.js";

export const ERASED_OBJECT_URI = "erased://redacted";

export function assertErasureAllowed(
  actor: Actor,
  evidence: readonly CaseEvidence[],
): void {
  assertPermission(actor, "privacy:erase");
  if (evidence.some((item) => item.legalHold && !item.erasedAt)) {
    throw new ForbiddenError("legal hold blocks erasure");
  }
}

export function eraseOrderPii(order: OrderRecord, erasedAt: string): OrderRecord {
  if (order.erasedAt) return order;
  return {
    ...order,
    piiRef: null,
    erasedAt,
  };
}

export function eraseEvidenceMetadata(item: CaseEvidence, erasedAt: string): CaseEvidence {
  if (item.legalHold && !item.erasedAt) {
    throw new ForbiddenError("legal hold blocks erasure");
  }
  if (item.erasedAt) return item;
  return {
    ...item,
    objectUri: ERASED_OBJECT_URI,
    erasedAt,
  };
}

export function eraseCaseArtifacts(input: {
  actor: Actor;
  tenantId: string;
  order: OrderRecord;
  evidence: readonly CaseEvidence[];
  reason: string;
  erasedAt: string;
}): { order: OrderRecord; evidence: CaseEvidence[]; redactedFields: string[] } {
  assertSameTenant(input.actor, input.tenantId);
  assertSameTenant(input.actor, input.order.tenantId);
  if (!input.reason.trim()) {
    throw new ValidationError("erasure reason is required");
  }
  assertErasureAllowed(input.actor, input.evidence);
  const order = eraseOrderPii(input.order, input.erasedAt);
  const evidence = input.evidence.map((item) => eraseEvidenceMetadata(item, input.erasedAt));
  const redactedFields = ["order.piiRef", ...evidence.map(() => "case_evidence.objectUri")];
  return { order, evidence, redactedFields };
}

export function placeLegalHold(item: CaseEvidence, legalHold: boolean): CaseEvidence {
  if (item.erasedAt) {
    throw new ValidationError("cannot change legal hold on erased evidence");
  }
  return { ...item, legalHold };
}
