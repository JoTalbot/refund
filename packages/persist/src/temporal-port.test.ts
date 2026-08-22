import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { applyMigrations, defaultMigrationsDir } from "./migrate.js";
import { SqlJobStore } from "./sql-jobs.js";
import { LeaseWorkflowRuntime, TemporalCloudRuntime, workflowRuntimeFromEnv } from "./temporal-port.js";

describe("workflow runtime port", () => {
  it("starts a lease workflow and refuses an unbound Temporal client", async () => {
    const db = new PGlite();
    await applyMigrations(db, defaultMigrationsDir(), { allowMissingPgcrypto: true });
    const jobs = new SqlJobStore(db);
    const runtime = workflowRuntimeFromEnv(jobs);
    expect(runtime).toBeInstanceOf(LeaseWorkflowRuntime);
    const handle = await runtime.start({
      workflowType: "import.merchant_export",
      ownerId: "worker-a",
      runId: "33333333-3333-4333-8333-333333333333",
      execute: () => ({ ok: true }),
    });
    expect(handle.runtime).toBe("lease");
    expect(handle.runId).toBe("33333333-3333-4333-8333-333333333333");

    const temporal = workflowRuntimeFromEnv(jobs, "temporal.example.invalid:7233");
    expect(temporal).toBeInstanceOf(TemporalCloudRuntime);
    await expect(temporal.start({ workflowType: "import.merchant_export", ownerId: "w", execute: () => null })).rejects.toThrow(
      /not bound/,
    );
  });
});
