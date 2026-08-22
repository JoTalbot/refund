import type {
  Actor,
  ApprovalRequest,
  AuditEvent,
  CaseEvidence,
  ImportRun,
  NormalizedProduct,
  OrderRecord,
  PolicySnapshot,
  ProductObservation,
  ProviderAction,
  ReturnCase,
  SourceRecord,
} from "@refund/domain";

export interface PlatformSnapshot {
  actors: Actor[];
  sources: SourceRecord[];
  products: NormalizedProduct[];
  observations: ProductObservation[];
  policies: PolicySnapshot[];
  orders: OrderRecord[];
  cases: ReturnCase[];
  approvals: ApprovalRequest[];
  actions: ProviderAction[];
  evidence: CaseEvidence[];
  imports: ImportRun[];
  audit: AuditEvent[];
}

export function emptySnapshot(): PlatformSnapshot {
  return {
    actors: [],
    sources: [],
    products: [],
    observations: [],
    policies: [],
    orders: [],
    cases: [],
    approvals: [],
    actions: [],
    evidence: [],
    imports: [],
    audit: [],
  };
}
