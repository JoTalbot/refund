import { describe, expect, it } from "vitest";
import { ConflictError } from "../src/errors.js";
import {
  checkpointLease,
  createLease,
  heartbeatLease,
  isLeaseExpired,
  takeoverExpiredLease,
} from "../src/jobs.js";

describe("durable job leases", () => {
  it("lets a new worker resume an expired lease and refuses a live steal", () => {
    const now = new Date("2026-08-22T12:00:00.000Z");
    const lease = createLease({
      runId: "run-1",
      jobType: "import",
      ownerId: "worker-a",
      now,
      ttlMs: 1000,
    });
    expect(isLeaseExpired(lease, now)).toBe(false);
    expect(() => takeoverExpiredLease(lease, "worker-b", now)).toThrow(ConflictError);

    const later = new Date(now.getTime() + 2000);
    expect(isLeaseExpired(lease, later)).toBe(true);
    const taken = takeoverExpiredLease(lease, "worker-b", later, 5000);
    expect(taken.ownerId).toBe("worker-b");
    const beat = heartbeatLease(taken, "worker-b", later, 5000);
    const check = checkpointLease(beat, "worker-b", "s3://example-refund-artifacts/run-1.json");
    expect(check.checkpointUri).toContain("run-1");
    expect(() => checkpointLease(check, "worker-a", "s3://x")).toThrow(ConflictError);
  });
});
