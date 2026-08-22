import { describe, expect, it } from "vitest";
import { attestCase, canTransition, createDraftCase, transitionCase } from "../src/cases.js";
import { ConflictError, ForbiddenError, ValidationError } from "../src/errors.js";
import { actor, draftCase } from "./helpers.js";

describe("case state machine", () => {
  it("creates drafts and requires attestation plus ownership", () => {
    const created = createDraftCase({
      id: "case-1",
      tenantId: "tenant-1",
      orderId: "order-1",
      policySnapshotId: "policy-1",
      ownershipVerifiedAt: null,
    });
    expect(created.state).toBe("draft");
    expect(created.version).toBe(1);

    const customer = actor("customer");
    let current = draftCase({ ownershipVerifiedAt: null });
    current = attestCase(customer, current, "2026-08-22T10:05:00.000Z");
    expect(() => transitionCase(customer, current, "submitted_for_approval", current.version)).toThrow(
      ValidationError,
    );
  });

  it("enforces legal transitions and optimistic concurrency", () => {
    expect(canTransition("resolved", "draft")).toBe(false);
    const customer = actor("customer");
    const current = draftCase({
      attestedAt: "2026-08-22T10:05:00.000Z",
      attestedBy: customer.id,
    });
    expect(() => transitionCase(customer, current, "submitted", current.version)).toThrow(
      ForbiddenError,
    );
    expect(() => transitionCase(customer, current, "merchant_review", current.version)).toThrow(
      ValidationError,
    );
    expect(() => transitionCase(customer, current, "submitted_for_approval", 99)).toThrow(
      ConflictError,
    );
  });
});
