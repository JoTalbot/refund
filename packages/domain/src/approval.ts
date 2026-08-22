import { randomUUID } from "node:crypto";
import { ConflictError, ForbiddenError, ValidationError } from "./errors.js";
import { assertIdempotencyKey } from "./idempotency.js";
import { assertPermission, assertSameTenant, assertStepUp } from "./rbac.js";
import { canStartImport } from "./sources.js";
import type {
  Actor,
  ApprovalRequest,
  ProviderAction,
  ReturnCase,
  SourceRecord,
} from "./types.js";

export interface DecideApprovalInput {
  actor: Actor;
  request: ApprovalRequest;
  decision: "approved" | "rejected";
  reason: string;
  decidedAt: string;
}

export function requestApproval(input: {
  actor: Actor;
  caseRecord: ReturnCase;
  reason: string;
  idempotencyKey: string;
  policyVersion: string;
}): ApprovalRequest {
  const { actor, caseRecord } = input;
  assertSameTenant(actor, caseRecord.tenantId);
  assertPermission(actor, "approvals:request");
  const key = assertIdempotencyKey(input.idempotencyKey);
  if (caseRecord.state !== "submitted_for_approval") {
    throw new ValidationError("approval can be requested only from submitted_for_approval");
  }
  if (!input.reason.trim()) {
    throw new ValidationError("approval reason is required");
  }
  return {
    id: randomUUID(),
    tenantId: caseRecord.tenantId,
    caseId: caseRecord.id,
    requestedBy: actor.id,
    approvedBy: null,
    decision: "pending",
    reason: input.reason.trim(),
    policyVersion: input.policyVersion,
    idempotencyKey: key,
    decidedAt: null,
  };
}

export function decideApproval(input: DecideApprovalInput): ApprovalRequest {
  const { actor, request } = input;
  assertSameTenant(actor, request.tenantId);
  assertPermission(actor, "approvals:decide");
  assertStepUp(actor, "approvals:decide");
  if (request.decision !== "pending") {
    throw new ConflictError("approval request is already decided");
  }
  if (actor.id === request.requestedBy) {
    throw new ForbiddenError("requester cannot approve their own request");
  }
  if (!input.reason.trim()) {
    throw new ValidationError("decision reason is required");
  }
  return {
    ...request,
    decision: input.decision,
    approvedBy: actor.id,
    reason: input.reason.trim(),
    decidedAt: input.decidedAt,
  };
}

export interface SubmitProviderActionInput {
  actor: Actor;
  caseRecord: ReturnCase;
  approval: ApprovalRequest;
  source?: SourceRecord;
  provider: string;
  actionType: string;
  idempotencyKey: string;
}

export function evaluateProviderSubmission(
  input: SubmitProviderActionInput,
): { ok: true } | { ok: false; code: string; message: string } {
  try {
    assertCanSubmitProviderAction(input);
    return { ok: true };
  } catch (error) {
    const err = error as { code?: string; message: string };
    return { ok: false, code: err.code ?? "forbidden", message: err.message };
  }
}

export function assertCanSubmitProviderAction(input: SubmitProviderActionInput): void {
  const { actor, caseRecord, approval } = input;
  assertSameTenant(actor, caseRecord.tenantId);
  assertPermission(actor, "provider_actions:submit");
  assertStepUp(actor, "provider_actions:submit");
  assertIdempotencyKey(input.idempotencyKey);

  if (caseRecord.state !== "approved_for_submission") {
    throw new ValidationError("case must be approved_for_submission before provider submit");
  }
  if (approval.caseId !== caseRecord.id || approval.tenantId !== caseRecord.tenantId) {
    throw new ValidationError("approval does not belong to this case");
  }
  if (approval.decision !== "approved") {
    throw new ForbiddenError("provider action requires an approved human decision");
  }
  if (!approval.approvedBy) {
    throw new ForbiddenError("approval is missing approved_by");
  }
  if (approval.approvedBy === approval.requestedBy) {
    throw new ForbiddenError("two-person control violated");
  }
  if (input.source && !canStartImport(input.source) && input.actionType !== "manual_guidance_only") {
    throw new ForbiddenError("source is not approved for automated provider calls");
  }
}

export function createProviderAction(input: SubmitProviderActionInput): ProviderAction {
  assertCanSubmitProviderAction(input);
  return {
    id: randomUUID(),
    tenantId: input.caseRecord.tenantId,
    caseId: input.caseRecord.id,
    provider: input.provider,
    actionType: input.actionType,
    idempotencyKey: input.idempotencyKey,
    approvalRequestId: input.approval.id,
    status: "queued",
    requestRef: null,
    responseRef: null,
  };
}
