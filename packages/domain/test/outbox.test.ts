import { describe, expect, it } from "vitest";
import {
  MemoryOutbox,
  createOutboxEvent,
  markOutboxFailed,
  markOutboxPublished,
  unpublishedOutbox,
} from "../src/outbox.js";
import { ValidationError } from "../src/errors.js";
import { TENANT } from "./helpers.js";

describe("transactional outbox", () => {
  it("creates redacted unpublished events and is idempotent by key", () => {
    const first = createOutboxEvent({
      tenantId: TENANT,
      aggregateType: "return_case",
      aggregateId: "case-1",
      eventType: "case.submitted",
      idempotencyKey: "outbox-case-submit-01",
      payload: { state: "submitted", authorization: "Bearer secret-token", password: "nope" },
    });
    expect(first.publishedAt).toBeNull();
    expect(first.payload).toEqual({ state: "submitted" });

    const box = new MemoryOutbox();
    expect(box.enqueue(first).id).toBe(first.id);
    expect(box.enqueue({ ...first, id: "other" }).id).toBe(first.id);
    expect(unpublishedOutbox(box.list(TENANT))).toHaveLength(1);

    const published = markOutboxPublished(first, "2026-08-22T12:00:00.000Z");
    box.replace(published);
    expect(box.unpublished(TENANT)).toHaveLength(0);
    expect(markOutboxFailed(first, "temporal not bound").publishedAttempts).toBe(1);
  });

  it("rejects an empty event type", () => {
    expect(() =>
      createOutboxEvent({
        tenantId: TENANT,
        aggregateType: "return_case",
        aggregateId: "case-1",
        eventType: "",
        idempotencyKey: "outbox-case-submit-02",
        payload: {},
      }),
    ).toThrow(ValidationError);
  });
});
