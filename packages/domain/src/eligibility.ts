import { ValidationError } from "./errors.js";
import { hashPayload } from "./audit.js";
import type {
  EligibilityEvaluation,
  EligibilityFacts,
  PolicyRules,
  PolicySnapshot,
  ReturnCase,
} from "./types.js";

export const EXTRACTOR_POLICY_VERSION = "policy-rules@1.0.0";

export function createPolicySnapshot(input: {
  id: string;
  sourceId: string;
  effectiveAt: string;
  rules: PolicyRules;
  evidenceUri?: string | null;
}): PolicySnapshot {
  if (input.rules.returnWindowDays < 0) {
    throw new ValidationError("returnWindowDays must be >= 0");
  }
  return {
    id: input.id,
    sourceId: input.sourceId,
    version: input.rules.version,
    contentHash: hashPayload(input.rules),
    effectiveAt: input.effectiveAt,
    rules: input.rules,
    evidenceUri: input.evidenceUri ?? null,
  };
}

export function evaluateEligibility(
  snapshot: PolicySnapshot,
  facts: EligibilityFacts,
): EligibilityEvaluation {
  const missing: string[] = [];
  const reasons: string[] = [];

  if (facts.region === undefined) missing.push("region");
  if (facts.condition === undefined) missing.push("condition");
  if (facts.daysSinceDelivery === undefined) missing.push("daysSinceDelivery");
  if (facts.category === undefined) missing.push("category");

  if (missing.length > 0) {
    return {
      result: "needs_review",
      policySnapshotId: snapshot.id,
      policyVersion: snapshot.version,
      reasons: ["insufficient facts for an automated eligibility decision"],
      missingFields: missing,
      recommendedMethods: [],
    };
  }

  const region = facts.region as string;
  const condition = facts.condition as string;
  const days = facts.daysSinceDelivery as number;
  const category = facts.category as string;

  if (days < 0) {
    throw new ValidationError("daysSinceDelivery must be >= 0");
  }

  if (!snapshot.rules.allowedRegions.includes(region)) {
    reasons.push(`region ${region} is outside the policy snapshot`);
  }
  if (snapshot.rules.excludedCategories.includes(category)) {
    reasons.push(`category ${category} is excluded by the policy snapshot`);
  }
  if (!snapshot.rules.allowedConditions.includes(condition)) {
    reasons.push(`condition ${condition} is not an allowed return reason`);
  }
  if (days > snapshot.rules.returnWindowDays) {
    reasons.push(
      `daysSinceDelivery ${days} exceeds return window ${snapshot.rules.returnWindowDays}`,
    );
  }
  if (facts.delivered === false && condition !== "not_received") {
    reasons.push("order is not delivered; only not_received can be evaluated");
  }

  if (reasons.length > 0) {
    return {
      result: "ineligible",
      policySnapshotId: snapshot.id,
      policyVersion: snapshot.version,
      reasons,
      missingFields: [],
      recommendedMethods: [],
    };
  }

  return {
    result: "eligible",
    policySnapshotId: snapshot.id,
    policyVersion: snapshot.version,
    reasons: ["facts match the versioned policy snapshot; payout is not decided here"],
    missingFields: [],
    recommendedMethods: [...snapshot.rules.methods],
  };
}

export function applyEligibility(current: ReturnCase, evaluation: EligibilityEvaluation): ReturnCase {
  return {
    ...current,
    eligibility: evaluation.result,
    policySnapshotId: evaluation.policySnapshotId,
    version: current.version + 1,
  };
}
