import { describe, expect, it } from "vitest";
import { ForbiddenError, ValidationError } from "../src/errors.js";
import { ERASED_OBJECT_URI, eraseCaseArtifacts, placeLegalHold } from "../src/retention.js";
import { actor, TENANT } from "./helpers.js";
import type { CaseEvidence, OrderRecord } from "../src/types.js";

const order: OrderRecord = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  tenantId: TENANT,
  provider: "merchant-self",
  externalId: "ORD-1",
  ownershipVerifiedAt: "2026-08-20T10:00:00.000Z",
  piiRef: "s3://example-refund-artifacts/pii/ord-1.json",
  lines: [{ sku: "SKU", title: "Mug", quantity: 1, amount: "12.50", currency: "EUR" }],
  createdAt: "2026-08-20T10:00:00.000Z",
  erasedAt: null,
};

const evidence: CaseEvidence = {
  id: "evidence-1",
  caseId: "case-1",
  objectUri: "s3://example-refund-artifacts/ord-1/unbox.mp4",
  checksum: "a".repeat(64),
  classification: "unboxing_video",
  expiresAt: null,
  legalHold: false,
  erasedAt: null,
};

describe("PII erasure", () => {
  it("redacts order PII and evidence URIs", () => {
    const result = eraseCaseArtifacts({
      actor: actor("compliance_admin"),
      tenantId: TENANT,
      order,
      evidence: [evidence],
      reason: "buyer erasure request",
      erasedAt: "2026-08-22T18:00:00.000Z",
    });
    expect(result.order.piiRef).toBeNull();
    expect(result.order.erasedAt).toBe("2026-08-22T18:00:00.000Z");
    expect(result.evidence[0]?.objectUri).toBe(ERASED_OBJECT_URI);
    expect(result.redactedFields).toContain("order.piiRef");
  });

  it("blocks erasure under legal hold and ignores customers", () => {
    const held = placeLegalHold(evidence, true);
    expect(() =>
      eraseCaseArtifacts({
        actor: actor("compliance_admin"),
        tenantId: TENANT,
        order,
        evidence: [held],
        reason: "buyer erasure request",
        erasedAt: "2026-08-22T18:00:00.000Z",
      }),
    ).toThrow(ForbiddenError);
    expect(() =>
      eraseCaseArtifacts({
        actor: actor("customer"),
        tenantId: TENANT,
        order,
        evidence: [evidence],
        reason: "please delete",
        erasedAt: "2026-08-22T18:00:00.000Z",
      }),
    ).toThrow(ForbiddenError);
    expect(() =>
      eraseCaseArtifacts({
        actor: actor("compliance_admin"),
        tenantId: TENANT,
        order,
        evidence: [evidence],
        reason: " ",
        erasedAt: "2026-08-22T18:00:00.000Z",
      }),
    ).toThrow(ValidationError);
  });
});
