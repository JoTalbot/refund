import { describe, expect, it } from "vitest";
import { ForbiddenError } from "../src/errors.js";
import {
  ALIEXPRESS_UA_SOURCE,
  SHOPIFY_MERCHANT_SOURCE,
  assertImportAllowed,
  canStartImport,
  transitionSource,
} from "../src/sources.js";
import { actor } from "./helpers.js";

describe("source registry", () => {
  it("keeps AliExpress UA in draft and blocks import", () => {
    expect(ALIEXPRESS_UA_SOURCE.status).toBe("draft");
    expect(ALIEXPRESS_UA_SOURCE.rateLimitPerMinute).toBe(0);
    expect(canStartImport(ALIEXPRESS_UA_SOURCE)).toBe(false);
    expect(() => assertImportAllowed(ALIEXPRESS_UA_SOURCE)).toThrow(ForbiddenError);
  });

  it("keeps Shopify merchant integration in draft without a connector", () => {
    expect(SHOPIFY_MERCHANT_SOURCE.status).toBe("draft");
    expect(SHOPIFY_MERCHANT_SOURCE.rateLimitPerMinute).toBe(0);
    expect(canStartImport(SHOPIFY_MERCHANT_SOURCE)).toBe(false);
    expect(SHOPIFY_MERCHANT_SOURCE.permissionBasis.toLowerCase()).toContain("oauth");
  });

  it("allows only compliance_admin to approve", () => {
    const reviewed = transitionSource(actor("merchant_admin"), ALIEXPRESS_UA_SOURCE, "review");
    expect(reviewed.status).toBe("review");
    expect(() => transitionSource(actor("merchant_admin"), reviewed, "approved")).toThrow(
      ForbiddenError,
    );
    const approved = transitionSource(actor("compliance_admin"), reviewed, "approved");
    expect(approved.status).toBe("approved");
    expect(canStartImport(approved)).toBe(true);
    expect(() => transitionSource(actor("operator"), approved, "suspended")).toThrow(ForbiddenError);
    expect(transitionSource(actor("compliance_admin"), approved, "suspended").status).toBe("suspended");
  });
});

