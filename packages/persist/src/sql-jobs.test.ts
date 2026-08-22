import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { ConflictError } from "@refund/domain";
import { applyMigrations, defaultMigrationsDir } from "./migrate.js";
import { SqlJobStore } from "./sql-jobs.js";
import { runDurableStep } from "./workflow.js";

describe("SQL job leases and durable step", () => {
  it("lets a second worker finish an expired import step", async () => {
    const db = new PGlite();
    await applyMigrations(db, defaultMigrationsDir(), { allowMissingPgcrypto: true });
    const jobs = new SqlJobStore(db);
    const start = new Date("2026-08-22T12:00:00.000Z");
    const first = await runDurableStep(jobs, {
      runId: "11111111-1111-4111-8111-111111111111",
      jobType: "import.merchant_export",
      ownerId: "worker-a",
      now: start,
      ttlMs: 1000,
      payload: { source: "merchant-self-export" },
      execute: () => ({ products: 2 }),
    });
    expect(first.output).toEqual({ products: 2 });

    const live = await jobs.get(first.runId);
    expect(live?.ownerId).toBe("worker-a");
    await expect(
      jobs.acquire({
        runId: first.runId,
        jobType: "import.merchant_export",
        ownerId: "worker-b",
        now: start,
      }),
    ).rejects.toBeInstanceOf(ConflictError);

    const resumed = await runDurableStep(jobs, {
      runId: first.runId,
      jobType: "import.merchant_export",
      ownerId: "worker-b",
      now: new Date(start.getTime() + 5000),
      ttlMs: 10_000,
      execute: (checkpoint) => ({ resumedFrom: checkpoint }),
    });
    expect(resumed.ownerId).toBe("worker-b");
    expect(resumed.output).toMatchObject({ resumedFrom: first.checkpointUri });
  });
});
