import { describe, expect, it } from "vitest";
import { ALIEXPRESS_UA_SOURCE, canStartImport } from "@refund/domain";

describe("api contract smoke", () => {
  it("exposes AliExpress only as a draft registry record", () => {
    expect(ALIEXPRESS_UA_SOURCE.status).toBe("draft");
    expect(canStartImport(ALIEXPRESS_UA_SOURCE)).toBe(false);
  });
});
