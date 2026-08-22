import { describe, expect, it } from "vitest";
import { ValidationError } from "../src/errors.js";
import { createEvidenceRecord } from "../src/evidence.js";

describe("evidence metadata", () => {
  it("accepts object-storage URIs and sha-256 checksums", () => {
    const item = createEvidenceRecord({
      id: "ev-1",
      caseId: "case-1",
      objectUri: "s3://example-refund-artifacts/demo/unbox.mp4",
      checksum: "A".repeat(64),
      classification: "unboxing_video",
    });
    expect(item.checksum).toBe("a".repeat(64));
    expect(item.legalHold).toBe(false);
    expect(() =>
      createEvidenceRecord({
        id: "ev-2",
        caseId: "case-1",
        objectUri: "javascript:alert(1)",
        checksum: "a".repeat(64),
        classification: "photo",
      }),
    ).toThrow(ValidationError);
    expect(() =>
      createEvidenceRecord({
        id: "ev-3",
        caseId: "case-1",
        objectUri: "https://example.invalid/a.jpg",
        checksum: "deadbeef",
        classification: "photo",
      }),
    ).toThrow(ValidationError);
  });
});
