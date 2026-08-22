import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { applyMigrations, defaultMigrationsDir, SqlJobStore } from "@refund/persist";
import { Platform } from "./platform.js";
import { runImportWorkflow } from "./worker.js";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("durable import worker", () => {
  it("resumes an expired import lease on another worker", async () => {
    const db = new PGlite();
    await applyMigrations(db, defaultMigrationsDir(), { allowMissingPgcrypto: true });
    const jobs = new SqlJobStore(db);
    const platform = new Platform();
    const merchant = {
      id: "merchant_admin-1",
      tenantId: TENANT,
      role: "merchant_admin" as const,
      stepUpVerified: true,
    };
    const source = platform.createSource(
      merchant,
      {
        slug: "merchant-self-export",
        owner: "demo",
        baseUrl: "https://merchant.example.invalid/",
        permissionBasis: "export",
        policyUrl: "https://merchant.example.invalid/returns",
        rateLimitPerMinute: 5,
        allowedFields: ["title"],
        retentionDays: 30,
      },
      "w1",
    );
    platform.reviewSource(merchant, source.id, "w2");
    platform.approveSource(
      { id: "compliance_admin-1", tenantId: TENANT, role: "compliance_admin", stepUpVerified: true },
      source.id,
      "w3",
    );

    const start = new Date("2026-08-22T12:00:00.000Z");
    const first = await runImportWorkflow(platform, jobs, {
      actor: merchant,
      sourceId: source.id,
      document: {
        export_id: "exp-w",
        exported_at: "2026-08-22T09:00:00.000Z",
        merchant_id: "m",
        consent: { granted_by: "o", granted_at: "2026-08-22T08:00:00.000Z" },
        products: [
          {
            id: "SKU-W",
            title: "Widget",
            url: "https://merchant.example.invalid/p/w",
            price: { amount: "1.00", currency: "EUR" },
            availability: "in_stock",
          },
        ],
      },
      idempotencyKey: "import-worker-00000001",
      ownerId: "worker-a",
      runId: "22222222-2222-4222-8222-222222222222",
      now: start,
      ttlMs: 1000,
      traceId: "w-import",
    });
    expect((first.output as { status: string }).status).toBe("succeeded");

    const resumed = await runImportWorkflow(platform, jobs, {
      actor: merchant,
      sourceId: source.id,
      document: {},
      idempotencyKey: "import-worker-00000001",
      ownerId: "worker-b",
      runId: first.runId,
      now: new Date(start.getTime() + 5000),
      ttlMs: 10_000,
      traceId: "w-import-2",
    });
    expect(resumed.ownerId).toBe("worker-b");
    expect((resumed.output as { id: string }).id).toBe((first.output as { id: string }).id);
  });
});
