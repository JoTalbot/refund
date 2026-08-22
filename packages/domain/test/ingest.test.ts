import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyImportFailure, parseMerchantExport } from "../src/ingest.js";
import { ALIEXPRESS_UA_SOURCE, createDraftSource, transitionSource } from "../src/sources.js";
import { actor } from "./helpers.js";

const fixture = JSON.parse(
  readFileSync(new URL("../../../fixtures/ingest/merchant-export.v1.json", import.meta.url), "utf8"),
) as unknown;

function approvedMerchantSource() {
  const draft = createDraftSource({
    id: "22222222-2222-4222-8222-222222222222",
    tenantId: actor("merchant_admin").tenantId,
    slug: "merchant-self-export",
    owner: "tenant-merchant",
    baseUrl: "https://merchant.example.invalid/",
    permissionBasis: "Signed merchant JSON export uploaded by the shop owner.",
    policyUrl: "https://merchant.example.invalid/returns",
    rateLimitPerMinute: 30,
    allowedFields: ["title", "sku", "price", "availability", "canonical_url"],
    retentionDays: 180,
    regionNotes: "Self-export only.",
  });
  const reviewed = transitionSource(actor("merchant_admin"), draft, "review");
  return transitionSource(actor("compliance_admin"), reviewed, "approved");
}

describe("merchant export ingest", () => {
  it("parses the fixture and refuses an unapproved source", () => {
    const source = approvedMerchantSource();
    const parsed = parseMerchantExport(source, fixture, "2026-08-22T12:00:00.000Z");
    expect(parsed.ok).toBe(true);
    expect(parsed.products).toHaveLength(2);
    expect(parsed.products[0]?.canonicalUrl.startsWith("https://")).toBe(true);
    expect(parsed.observations).toHaveLength(2);
    expect(parsed.extractorVersion).toBe("merchant-export@1.0.0");

    const blocked = classifyImportFailure(ALIEXPRESS_UA_SOURCE, new Error("should not fetch"));
    expect(blocked.status).toBe("blocked");
    expect(blocked.errorClass).toBe("policy_blocked");
    expect(() => parseMerchantExport(ALIEXPRESS_UA_SOURCE, fixture, "2026-08-22T12:00:00.000Z")).toThrow(
      /import blocked/,
    );
  });

  it("does not emit products for a broken document", () => {
    const source = approvedMerchantSource();
    const parsed = parseMerchantExport(source, { products: [{ title: "x" }] }, "2026-08-22T12:00:00.000Z");
    expect(parsed.ok).toBe(false);
    expect(parsed.products).toHaveLength(0);
    expect(parsed.issues.some((issue) => issue.class === "non_retryable")).toBe(true);
  });
});
