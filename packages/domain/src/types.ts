export const ROLES = [
  "customer",
  "operator",
  "approver",
  "merchant_admin",
  "auditor",
  "service_agent",
  "compliance_admin",
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "sources:create",
  "sources:review",
  "sources:approve",
  "sources:read",
  "import:start",
  "orders:import",
  "orders:read",
  "cases:create",
  "cases:read",
  "cases:update",
  "cases:attest",
  "eligibility:recalculate",
  "approvals:request",
  "approvals:decide",
  "provider_actions:submit",
  "audit:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const CASE_STATES = [
  "draft",
  "evidence_pending",
  "submitted_for_approval",
  "approved_for_submission",
  "submitted",
  "merchant_review",
  "return_in_transit",
  "received",
  "resolved",
  "rejected",
  "cancelled",
] as const;

export type CaseState = (typeof CASE_STATES)[number];

export const SOURCE_STATUSES = ["draft", "review", "approved", "suspended"] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export const ELIGIBILITY_RESULTS = ["eligible", "ineligible", "needs_review"] as const;
export type EligibilityResult = (typeof ELIGIBILITY_RESULTS)[number];

export const APPROVAL_DECISIONS = ["pending", "approved", "rejected"] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

export const PROVIDER_ACTION_STATUSES = [
  "queued",
  "submitted",
  "acknowledged",
  "failed",
  "cancelled",
] as const;
export type ProviderActionStatus = (typeof PROVIDER_ACTION_STATUSES)[number];

export interface Actor {
  id: string;
  tenantId: string;
  role: Role;
  stepUpVerified: boolean;
}

export interface ReturnCase {
  id: string;
  tenantId: string;
  orderId: string;
  state: CaseState;
  eligibility: EligibilityResult;
  policySnapshotId: string;
  version: number;
  attestedAt: string | null;
  attestedBy: string | null;
  ownershipVerifiedAt: string | null;
}

export interface ApprovalRequest {
  id: string;
  tenantId: string;
  caseId: string;
  requestedBy: string;
  approvedBy: string | null;
  decision: ApprovalDecision;
  reason: string;
  policyVersion: string;
  idempotencyKey: string;
  decidedAt: string | null;
}

export interface ProviderAction {
  id: string;
  tenantId: string;
  caseId: string;
  provider: string;
  actionType: string;
  idempotencyKey: string;
  approvalRequestId: string;
  status: ProviderActionStatus;
  requestRef: string | null;
  responseRef: string | null;
}

export interface AuditEvent {
  id: string;
  tenantId: string;
  occurredAt: string;
  actorId: string;
  actorRole: Role;
  action: string;
  entityType: string;
  entityId: string;
  caseId?: string;
  policyVersion?: string;
  providerCorrelationId?: string;
  beforeHash?: string;
  afterHash: string;
  prevEventHash: string | null;
  eventHash: string;
  traceId: string;
  payloadRedacted: Record<string, unknown>;
}

export interface SourceRecord {
  id: string;
  slug: string;
  owner: string;
  baseUrl: string;
  permissionBasis: string;
  policyUrl: string;
  status: SourceStatus;
  rateLimitPerMinute: number;
  allowedFields: string[];
  retentionDays: number;
  regionNotes: string;
}
