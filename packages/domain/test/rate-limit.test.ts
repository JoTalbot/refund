import { describe, expect, it } from "vitest";
import { RateLimitError } from "../src/errors.js";
import { SlidingWindowLimiter } from "../src/rate-limit.js";

describe("source rate limiter", () => {
  it("allows traffic under the window and then blocks", () => {
    const limiter = new SlidingWindowLimiter(60_000);
    const now = Date.parse("2026-08-22T12:00:00.000Z");
    expect(limiter.tryAcquire("src-1", 2, now)).toBe(true);
    expect(limiter.tryAcquire("src-1", 2, now + 10)).toBe(true);
    expect(limiter.tryAcquire("src-1", 2, now + 20)).toBe(false);
    expect(limiter.tryAcquire("src-1", 2, now + 60_001)).toBe(true);
    expect(() => limiter.acquireOrThrow("src-1", 1, now + 60_010, "merchant-self-export")).toThrow(
      RateLimitError,
    );
  });
});
