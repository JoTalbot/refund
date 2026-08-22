import { describe, expect, it } from "vitest";
import { applyEligibility, createPolicySnapshot, evaluateEligibility } from "../src/eligibility.js";
import { draftCase } from "./helpers.js";

const snapshot = createPolicySnapshot({
  id: "policy-1",
  sourceId: "source-1",
  effectiveAt: "2026-08-01T00:00:00.000Z",
  rules: {
    version: "merchant-return-2026-08",
    returnWindowDays: 14,
    allowedRegions: ["UA", "EU"],
    allowedConditions: ["unused", "defective", "not_as_described", "not_received"],
    excludedCategories: ["digital"],
    buyerPaysReturnShipping: true,
    methods: ["refund", "replacement"],
  },
});

describe("eligibility engine", () => {
  it("returns needs_review when facts are incomplete", () => {
    const result = evaluateEligibility(snapshot, { region: "UA" });
    expect(result.result).toBe("needs_review");
    expect(result.missingFields).toContain("condition");
    expect(result.recommendedMethods).toEqual([]);
  });

  it("marks matching facts eligible without deciding a payout", () => {
    const result = evaluateEligibility(snapshot, {
      region: "UA",
      condition: "not_as_described",
      daysSinceDelivery: 3,
      category: "home",
      delivered: true,
    });
    expect(result.result).toBe("eligible");
    expect(result.reasons.join(" ")).toMatch(/payout is not decided/i);
    const updated = applyEligibility(draftCase(), result);
    expect(updated.eligibility).toBe("eligible");
    expect(updated.version).toBe(2);
  });

  it("rejects excluded category, region and expired window", () => {
    expect(
      evaluateEligibility(snapshot, {
        region: "US",
        condition: "unused",
        daysSinceDelivery: 1,
        category: "home",
      }).result,
    ).toBe("ineligible");
    expect(
      evaluateEligibility(snapshot, {
        region: "UA",
        condition: "unused",
        daysSinceDelivery: 40,
        category: "home",
      }).result,
    ).toBe("ineligible");
    expect(
      evaluateEligibility(snapshot, {
        region: "UA",
        condition: "unused",
        daysSinceDelivery: 1,
        category: "digital",
      }).result,
    ).toBe("ineligible");
  });
});
