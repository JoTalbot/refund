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
  tenantId?: string | null;
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

export const AVAILABILITIES = ["in_stock", "out_of_stock", "unknown"] as const;
export type Availability = (typeof AVAILABILITIES)[number];

export interface Money {
  amount: string;
  currency: string;
}

export interface NormalizedProduct {
  id: string;
  sourceId: string;
  sourceProductId: string;
  canonicalUrl: string;
  title: string;
  brand: string | null;
  sku: string | null;
  price: Money;
  availability: Availability;
  returnPolicySnapshotId: string | null;
  extractorVersion: string;
  fetchedAt: string;
  evidenceUri: string | null;
  fieldConfidence: Record<string, number>;
}

export interface ProductObservation {
  id: string;
  sourceProductId: string;
  observedAt: string;
  price: Money;
  availability: Availability;
  evidenceUri: string | null;
}

export interface PolicyRules {
  version: string;
  returnWindowDays: number;
  allowedRegions: string[];
  allowedConditions: string[];
  excludedCategories: string[];
  buyerPaysReturnShipping: boolean;
  methods: string[];
}

export interface PolicySnapshot {
  id: string;
  sourceId: string;
  version: string;
  contentHash: string;
  effectiveAt: string;
  rules: PolicyRules;
  evidenceUri: string | null;
}

export interface OrderLine {
  sku: string | null;
  title: string;
  quantity: number;
  amount: string;
  currency: string;
}

export interface OrderRecord {
  id: string;
  tenantId: string;
  provider: string;
  externalId: string;
  ownershipVerifiedAt: string | null;
  piiRef: string | null;
  lines: OrderLine[];
  createdAt: string;
}

export interface EligibilityFacts {
  region?: string;
  condition?: string;
  daysSinceDelivery?: number;
  category?: string;
  delivered?: boolean;
}

export interface EligibilityEvaluation {
  result: EligibilityResult;
  policySnapshotId: string;
  policyVersion: string;
  reasons: string[];
  missingFields: string[];
  recommendedMethods: string[];
}

export interface ImportRun {
  id: string;
  tenantId: string;
  sourceId: string;
  kind: "merchant_export";
  status: "succeeded" | "failed" | "blocked";
  extractorVersion: string;
  idempotencyKey: string;
  productsUpserted: number;
  observationsAppended: number;
  errorClass: "retryable" | "non_retryable" | "policy_blocked" | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface JobLease {
  runId: string;
  jobType: string;
  ownerId: string;
  expiresAt: string;
  checkpointUri: string | null;
  payload: Record<string, unknown>;
  version: number;
}

export interface CaseEvidence {
  id: string;
  caseId: string;
  objectUri: string;
  checksum: string;
  classification: string;
  expiresAt: string | null;
}
