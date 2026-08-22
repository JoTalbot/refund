import { describe, expect, it } from "vitest";
import { ForbiddenError, ValidationError } from "../src/errors.js";
import { reconcileProviderAction } from "../src/reconcile.js";
import { actor, TENANT } from "./helpers.js";
import type { ProviderAction } from "../src/types.js";

const action: ProviderAction = {
  id: "action-1",
  tenantId: TENANT,
  caseId: "case-1",
  provider: "manual",
  actionType: "manual_guidance_only",
  idempotencyKey: "provider-submit-recon-01",
  approvalRequestId: "approval-1",
  status: "queued",
  requestRef: null,
  responseRef: null,
};

describe("provider action reconciliation", () => {
  it("lets an operator record a documented merchant acknowledgement", () => {
    const next = reconcileProviderAction({
      actor: actor("operator"),
      action,
      nextStatus: "submitted",
      correlationId: "manual-desk-4421",
      note: "Merchant emailed a ticket id",
    });
    expect(next.status).toBe("submitted");
    expect(next.responseRef).toBe("manual-desk-4421");
  });

  it("does not treat acknowledgement as a payout and blocks customers", () => {
    expect(() =>
      reconcileProviderAction({
        actor: actor("customer"),
        action,
        nextStatus: "acknowledged",
        correlationId: "x",
        note: "please",
      }),
    ).toThrow(ForbiddenError);
    expect(() =>
      reconcileProviderAction({
        actor: actor("operator"),
        action: { ...action, status: "acknowledged" },
        nextStatus: "queued",
        correlationId: "x",
        note: "rewind",
      }),
    ).toThrow(ValidationError);
  });
});
