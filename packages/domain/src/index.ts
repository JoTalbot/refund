export type ReturnCaseState =
  | 'draft' | 'evidence_pending' | 'submitted_for_approval'
  | 'approved_for_submission' | 'submitted' | 'merchant_review'
  | 'return_in_transit' | 'received' | 'resolved' | 'rejected' | 'cancelled';

const allowedTransitions: Readonly<Record<ReturnCaseState, readonly ReturnCaseState[]>> = {
  draft: ['evidence_pending', 'submitted_for_approval', 'cancelled'],
  evidence_pending: ['draft', 'submitted_for_approval', 'cancelled'],
  submitted_for_approval: ['approved_for_submission', 'draft', 'cancelled'],
  approved_for_submission: ['submitted', 'cancelled'],
  submitted: ['merchant_review', 'return_in_transit', 'resolved', 'rejected', 'cancelled'],
  merchant_review: ['return_in_transit', 'resolved', 'rejected', 'cancelled'],
  return_in_transit: ['received', 'resolved', 'rejected'],
  received: ['resolved', 'rejected'],
  resolved: [], rejected: [], cancelled: []
};

export function canTransition(from: ReturnCaseState, to: ReturnCaseState): boolean {
  return allowedTransitions[from].includes(to);
}

export function assertTransition(from: ReturnCaseState, to: ReturnCaseState): void {
  if (!canTransition(from, to)) throw new Error(`Invalid return case transition: ${from} -> ${to}`);
}

export type AuditAction = 'created' | 'updated' | 'state_transition' | 'approval_requested' | 'external_submission';
export interface AuditEventInput {
  tenantId: string; actorId: string; action: AuditAction; entityType: string; entityId: string;
  traceId: string; occurredAt: Date; metadata?: Record<string, unknown>;
}
