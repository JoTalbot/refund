import { describe, expect, it } from "vitest";
import { ValidationError } from "../src/errors.js";
import { MemoryLogSink, assertNoSecrets, createLogEvent, formatLogLine } from "../src/logging.js";

describe("structured logs", () => {
  it("emits JSON with trace and actor and refuses secrets", () => {
    const event = createLogEvent({
      message: "POST /v1/return-cases",
      traceId: "trace-1",
      actorId: "operator-1",
      caseId: "case-1",
      action: "http.request",
      status: 201,
    });
    expect(formatLogLine(event)).toContain("\"traceId\":\"trace-1\"");
    const sink = new MemoryLogSink();
    sink.write(event);
    expect(sink.events).toHaveLength(1);
    expect(() => assertNoSecrets({ authorization: "Bearer abc" })).toThrow(ValidationError);
  });
});
