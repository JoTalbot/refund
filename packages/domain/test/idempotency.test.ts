import { describe, expect, it } from "vitest";
import { ConflictError, ValidationError } from "../src/errors.js";
import { IdempotencyStore, assertIdempotencyKey } from "../src/idempotency.js";

describe("idempotency", () => {
  it("rejects weak keys and conflicting replays", () => {
    expect(() => assertIdempotencyKey("short")).toThrow(ValidationError);
    const store = new IdempotencyStore<{ n: number }>();
    const first = store.remember("t1", "idempotency-key-01", { n: 1 });
    expect(store.remember("t1", "idempotency-key-01", { n: 1 })).toEqual(first);
    expect(() => store.remember("t1", "idempotency-key-01", { n: 2 })).toThrow(ConflictError);
  });
});
