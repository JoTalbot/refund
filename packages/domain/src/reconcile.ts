import { ValidationError } from "./errors.js";
import { assertPermission, assertSameTenant } from "./rbac.js";
import type { Actor, ProviderAction, ProviderActionStatus } from "./types.js";

export const ACTION_STATUS_TRANSITIONS: Record<
  ProviderActionStatus,
  readonly ProviderActionStatus[]
> = {
  queued: ["submitted", "failed", "cancelled"],
  submitted: ["acknowledged", "failed", "cancelled"],
  acknowledged: [],
  failed: ["queued"],
  cancelled: [],
};

export function canReconcileAction(
  from: ProviderActionStatus,
  to: ProviderActionStatus,
): boolean {
  return ACTION_STATUS_TRANSITIONS[from].includes(to);
}

export function reconcileProviderAction(input: {
  actor: Actor;
  action: ProviderAction;
  nextStatus: ProviderActionStatus;
  correlationId: string;
  note: string;
}): ProviderAction {
  assertSameTenant(input.actor, input.action.tenantId);
  assertPermission(input.actor, "provider_actions:reconcile");
  if (!input.correlationId.trim()) {
    throw new ValidationError("provider correlation id is required");
  }
  if (!input.note.trim()) {
    throw new ValidationError("reconciliation note is required");
  }
  if (!canReconcileAction(input.action.status, input.nextStatus)) {
    throw new ValidationError(
      `illegal provider action transition ${input.action.status} -> ${input.nextStatus}`,
    );
  }
  return {
    ...input.action,
    status: input.nextStatus,
    responseRef: input.correlationId.trim(),
  };
}
