import { ConflictError, ForbiddenError, ValidationError } from "./errors.js";
import { assertPermission, assertSameTenant } from "./rbac.js";
import type { Actor, CaseState, ReturnCase } from "./types.js";

export const CASE_TRANSITIONS: Record<CaseState, readonly CaseState[]> = {
  draft: ["evidence_pending", "submitted_for_approval", "cancelled"],
  evidence_pending: ["submitted_for_approval", "draft", "cancelled"],
  submitted_for_approval: ["approved_for_submission", "draft", "cancelled"],
  approved_for_submission: ["submitted", "cancelled"],
  submitted: ["merchant_review", "rejected", "cancelled"],
  merchant_review: ["return_in_transit", "received", "resolved", "rejected", "cancelled"],
  return_in_transit: ["received", "rejected", "cancelled"],
  received: ["resolved", "rejected"],
  resolved: [],
  rejected: [],
  cancelled: [],
};

export function canTransition(from: CaseState, to: CaseState): boolean {
  return CASE_TRANSITIONS[from].includes(to);
}

export function transitionCase(
  actor: Actor,
  current: ReturnCase,
  nextState: CaseState,
  expectedVersion: number,
): ReturnCase {
  assertSameTenant(actor, current.tenantId);
  if (nextState === "submitted") {
    assertPermission(actor, "provider_actions:submit");
  } else if (nextState === "approved_for_submission") {
    assertPermission(actor, "approvals:decide");
  } else {
    assertPermission(actor, "cases:update");
  }

  if (current.version !== expectedVersion) {
    throw new ConflictError("case version conflict");
  }
  if (!canTransition(current.state, nextState)) {
    throw new ValidationError(`illegal transition ${current.state} -> ${nextState}`);
  }
  const reconcileStates: CaseState[] = [
    "merchant_review",
    "return_in_transit",
    "received",
    "resolved",
    "rejected",
  ];
  if (reconcileStates.includes(nextState) && actor.role !== "operator" && actor.role !== "merchant_admin") {
    throw new ForbiddenError("only operator or merchant_admin may reconcile post-submit states");
  }
  if (nextState === "submitted_for_approval") {
    if (!current.attestedAt || !current.attestedBy) {
      throw new ValidationError("user attestation is required before approval request");
    }
    if (!current.ownershipVerifiedAt) {
      throw new ValidationError("order ownership must be verified before approval request");
    }
  }
  if (nextState === "submitted" && actor.role !== "approver") {
    throw new ForbiddenError("only an approver may move a case to submitted");
  }

  return {
    ...current,
    state: nextState,
    version: current.version + 1,
  };
}

export function attestCase(actor: Actor, current: ReturnCase, attestedAt: string): ReturnCase {
  assertSameTenant(actor, current.tenantId);
  assertPermission(actor, "cases:attest");
  if (current.state !== "draft" && current.state !== "evidence_pending") {
    throw new ValidationError("attestation is only allowed in draft or evidence_pending");
  }
  return {
    ...current,
    attestedAt,
    attestedBy: actor.id,
    version: current.version + 1,
  };
}

export function createDraftCase(input: {
  id: string;
  tenantId: string;
  orderId: string;
  policySnapshotId: string;
  ownershipVerifiedAt: string | null;
}): ReturnCase {
  return {
    id: input.id,
    tenantId: input.tenantId,
    orderId: input.orderId,
    state: "draft",
    eligibility: "needs_review",
    policySnapshotId: input.policySnapshotId,
    version: 1,
    attestedAt: null,
    attestedBy: null,
    ownershipVerifiedAt: input.ownershipVerifiedAt,
  };
}
