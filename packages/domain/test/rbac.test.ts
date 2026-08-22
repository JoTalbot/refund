import { describe, expect, it } from "vitest";
import { ForbiddenError } from "../src/errors.js";
import {
  PERMISSION_MATRIX,
  assertPermission,
  assertStepUp,
  hasPermission,
  permissionsFor,
} from "../src/rbac.js";
import { PERMISSIONS, ROLES } from "../src/types.js";
import { actor } from "./helpers.js";

describe("RBAC matrix", () => {
  it("covers every role", () => {
    expect(PERMISSION_MATRIX.map((row) => row.role).sort()).toEqual([...ROLES].sort());
  });

  it("never grants provider submit to customers, operators or auditors", () => {
    for (const role of ["customer", "operator", "auditor", "service_agent"] as const) {
      expect(hasPermission(actor(role), "provider_actions:submit")).toBe(false);
      expect(hasPermission(actor(role), "approvals:decide")).toBe(false);
    }
  });

  it("requires compliance_admin to approve sources", () => {
    expect(hasPermission(actor("compliance_admin"), "sources:approve")).toBe(true);
    expect(hasPermission(actor("merchant_admin"), "sources:approve")).toBe(false);
    expect(hasPermission(actor("operator"), "sources:approve")).toBe(false);
  });

  it("keeps auditors read-only", () => {
    const readOnly = new Set(permissionsFor("auditor"));
    for (const permission of PERMISSIONS) {
      if (permission.endsWith(":read")) {
        expect(readOnly.has(permission)).toBe(true);
      } else {
        expect(readOnly.has(permission)).toBe(false);
      }
    }
  });

  it("blocks missing permissions and missing step-up", () => {
    expect(() => assertPermission(actor("customer"), "approvals:decide")).toThrow(ForbiddenError);
    expect(() => assertStepUp(actor("approver", "approver-1", false), "approvals:decide")).toThrow(
      ForbiddenError,
    );
    expect(() => assertStepUp(actor("approver"), "approvals:decide")).not.toThrow();
  });
});
