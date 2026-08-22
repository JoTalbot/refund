import { ForbiddenError } from "./errors.js";
import type { Actor, Permission, Role } from "./types.js";

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  customer: [
    "cases:create",
    "cases:read",
    "cases:update",
    "cases:attest",
    "orders:import",
    "orders:read",
    "eligibility:recalculate",
    "approvals:request",
  ],
  operator: [
    "sources:create",
    "sources:read",
    "orders:read",
    "cases:read",
    "cases:update",
    "eligibility:recalculate",
    "approvals:request",
    "audit:read",
  ],
  approver: [
    "sources:read",
    "orders:read",
    "cases:read",
    "approvals:decide",
    "provider_actions:submit",
    "audit:read",
  ],
  merchant_admin: [
    "sources:create",
    "sources:review",
    "sources:read",
    "import:start",
    "orders:import",
    "orders:read",
    "cases:read",
    "audit:read",
  ],
  auditor: ["sources:read", "orders:read", "cases:read", "audit:read"],
  service_agent: ["sources:read", "cases:read", "orders:read"],
  compliance_admin: [
    "sources:create",
    "sources:review",
    "sources:approve",
    "sources:read",
    "audit:read",
    "cases:read",
  ],
};

export function permissionsFor(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(actor: Actor, permission: Permission): boolean {
  return ROLE_PERMISSIONS[actor.role].includes(permission);
}

export function assertPermission(actor: Actor, permission: Permission): void {
  if (!hasPermission(actor, permission)) {
    throw new ForbiddenError(`role ${actor.role} lacks ${permission}`);
  }
}

export function assertSameTenant(actor: Actor, tenantId: string): void {
  if (actor.tenantId !== tenantId) {
    throw new ForbiddenError("tenant mismatch");
  }
}

export function assertStepUp(actor: Actor, permission: Permission): void {
  if (permission === "approvals:decide" || permission === "provider_actions:submit") {
    if (!actor.stepUpVerified) {
      throw new ForbiddenError(`step-up authentication required for ${permission}`);
    }
  }
}

export const PERMISSION_MATRIX: ReadonlyArray<{
  role: Role;
  permissions: readonly Permission[];
}> = (Object.keys(ROLE_PERMISSIONS) as Role[]).map((role) => ({
  role,
  permissions: ROLE_PERMISSIONS[role],
}));
