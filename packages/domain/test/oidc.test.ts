import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "../src/errors.js";
import { actorFromDevHeaders, actorFromOidcClaims } from "../src/oidc.js";

describe("identity adapters", () => {
  it("maps OIDC claims and requires step-up markers for privileged ACR", () => {
    const actor = actorFromOidcClaims({
      sub: "user-1",
      tenant_id: "tenant-1",
      role: "approver",
      acr: "urn:refund:step-up",
    });
    expect(actor.stepUpVerified).toBe(true);
    expect(actor.role).toBe("approver");
    expect(
      actorFromOidcClaims({ sub: "user-1", tenant_id: "tenant-1", role: "customer" }).stepUpVerified,
    ).toBe(false);
  });

  it("accepts dev headers only when explicitly allowed", () => {
    expect(() =>
      actorFromDevHeaders({ "x-actor-id": "a", "x-actor-role": "customer", "x-tenant-id": "t" }, false),
    ).toThrow(UnauthorizedError);
    const actor = actorFromDevHeaders(
      {
        "x-actor-id": "a",
        "x-actor-role": "customer",
        "x-tenant-id": "t",
        "x-step-up": "true",
      },
      true,
    );
    expect(actor.stepUpVerified).toBe(true);
  });
});
