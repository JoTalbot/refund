import { describe, expect, it } from "vitest";
import {
  assertCanSubmitProviderAction,
  createProviderAction,
  decideApproval,
  evaluateProviderSubmission,
  requestApproval,
} from "../src/approval.js";
import { transitionCase, attestCase } from "../src/cases.js";
import { ForbiddenError, ValidationError } from "../src/errors.js";
import { ALIEXPRESS_UA_SOURCE } from "../src/sources.js";
import { actor, approvedRequest, draftCase } from "./helpers.js";

describe("approval boundary", () => {
  it("requires attestation, ownership and a second person before provider submit", () => {
    const customer = actor("customer");
    const approver = actor("approver");
    let current = draftCase();
    current = attestCase(customer, current, "2026-08-22T10:05:00.000Z");
    current = transitionCase(customer, current, "submitted_for_approval", current.version);

    const pending = requestApproval({
      actor: customer,
      caseRecord: current,
      reason: "Buyer-owned order, not as described",
      idempotencyKey: "approval-request-0001",
      policyVersion: "policy-2026-08-22",
    });
    expect(pending.decision).toBe("pending");
    expect(() =>
      decideApproval({
        actor: customer,
        request: pending,
        decision: "approved",
        reason: "self",
        decidedAt: "2026-08-22T11:00:00.000Z",
      }),
    ).toThrow(ForbiddenError);

    const decided = decideApproval({
      actor: approver,
      request: pending,
      decision: "approved",
      reason: "Evidence matches the owned order",
      decidedAt: "2026-08-22T11:00:00.000Z",
    });
    current = transitionCase(approver, current, "approved_for_submission", current.version);

    const action = createProviderAction({
      actor: approver,
      caseRecord: current,
      approval: decided,
      provider: "manual",
      actionType: "manual_guidance_only",
      idempotencyKey: "provider-submit-0001",
    });
    expect(action.status).toBe("queued");
  });

  it("blocks submit without approval, step-up, or approved source automation", () => {
    const approver = actor("approver");
    const caseRecord = draftCase({ state: "approved_for_submission", version: 4 });
    const result = evaluateProviderSubmission({
      actor: approver,
      caseRecord,
      approval: approvedRequest({ decision: "rejected" }),
      provider: "aliexpress",
      actionType: "create_return",
      idempotencyKey: "provider-submit-0002",
    });
    expect(result.ok).toBe(false);

    expect(() =>
      assertCanSubmitProviderAction({
        actor: actor("approver", "approver-1", false),
        caseRecord,
        approval: approvedRequest(),
        provider: "manual",
        actionType: "manual_guidance_only",
        idempotencyKey: "provider-submit-0003",
      }),
    ).toThrow(ForbiddenError);

    expect(() =>
      assertCanSubmitProviderAction({
        actor: approver,
        caseRecord,
        approval: approvedRequest(),
        source: ALIEXPRESS_UA_SOURCE,
        provider: "aliexpress",
        actionType: "create_return",
        idempotencyKey: "provider-submit-0004",
      }),
    ).toThrow(ForbiddenError);

    expect(() =>
      requestApproval({
        actor: actor("customer"),
        caseRecord: draftCase(),
        reason: "too early",
        idempotencyKey: "approval-request-0002",
        policyVersion: "v1",
      }),
    ).toThrow(ValidationError);
  });

  it("rejects self-approval even if the record is forged", () => {
    expect(() =>
      assertCanSubmitProviderAction({
        actor: actor("approver"),
        caseRecord: draftCase({ state: "approved_for_submission" }),
        approval: approvedRequest({ requestedBy: "approver-1", approvedBy: "approver-1" }),
        provider: "manual",
        actionType: "manual_guidance_only",
        idempotencyKey: "provider-submit-0005",
      }),
    ).toThrow(ForbiddenError);
  });
});
