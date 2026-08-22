import type { Actor, ApprovalRequest, ReturnCase } from "../src/types.js";

export const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

export function actor(role: Actor["role"], id = `${role}-1`, stepUp = true): Actor {
  return { id, tenantId: TENANT, role, stepUpVerified: stepUp };
}

export function draftCase(overrides: Partial<ReturnCase> = {}): ReturnCase {
  return {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    tenantId: TENANT,
    orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    state: "draft",
    eligibility: "needs_review",
    policySnapshotId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    version: 1,
    attestedAt: null,
    attestedBy: null,
    ownershipVerifiedAt: "2026-08-22T10:00:00.000Z",
    ...overrides,
  };
}

export function approvedRequest(overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    tenantId: TENANT,
    caseId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    requestedBy: "customer-1",
    approvedBy: "approver-1",
    decision: "approved",
    reason: "Legitimate buyer-owned order, evidence reviewed",
    policyVersion: "policy-2026-08-22",
    idempotencyKey: "approve-case-0001-xx",
    decidedAt: "2026-08-22T11:00:00.000Z",
    ...overrides,
  };
}
