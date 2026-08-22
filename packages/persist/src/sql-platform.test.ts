import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { Platform } from "../../../apps/api/src/platform.js";
import { applyMigrations, defaultMigrationsDir } from "./migrate.js";
import { SqlPlatformStore } from "./sql-platform.js";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const fixture = JSON.parse(
  readFileSync(new URL("../../../fixtures/ingest/merchant-export.v1.json", import.meta.url), "utf8"),
) as unknown;

function actor(role: "merchant_admin" | "compliance_admin" | "customer" | "approver") {
  return { id: `${role}-1`, tenantId: TENANT, role, stepUpVerified: true };
}

describe("SQL platform snapshot", () => {
  it("rehydrates a submitted case after a new process loads the snapshot", async () => {
    const db = new PGlite();
    await applyMigrations(db, defaultMigrationsDir(), { allowMissingPgcrypto: true });
    const store = new SqlPlatformStore(db);
    const live = new Platform();

    const source = live.createSource(
      actor("merchant_admin"),
      {
        slug: "merchant-self-export",
        owner: "demo",
        baseUrl: "https://merchant.example.invalid/",
        permissionBasis: "export",
        policyUrl: "https://merchant.example.invalid/returns",
        rateLimitPerMinute: 10,
        allowedFields: ["title"],
        retentionDays: 30,
      },
      "t1",
    );
    live.reviewSource(actor("merchant_admin"), source.id, "t2");
    live.approveSource(actor("compliance_admin"), source.id, "t3");
    live.importMerchantExport(
      actor("merchant_admin"),
      { sourceId: source.id, document: fixture, idempotencyKey: "import-sql-platform-01" },
      "t4",
    );
    const order = live.importOrder(
      actor("customer"),
      {
        provider: "merchant-self",
        externalId: "ORD-SQL-1",
        ownershipVerifiedAt: "2026-08-20T10:00:00.000Z",
        lines: [{ sku: "SKU-MUG-1", title: "Mug", quantity: 1, amount: "12.50", currency: "EUR" }],
        idempotencyKey: "order-sql-platform-01",
      },
      "t5",
    );
    const draft = live.createCase(actor("customer"), { orderId: order.id }, "t6");
    live.evaluateCase(
      actor("customer"),
      draft.id,
      { region: "UA", condition: "not_as_described", daysSinceDelivery: 2, category: "home", delivered: true },
      "t7",
    );
    live.addEvidence(
      actor("customer"),
      draft.id,
      {
        objectUri: "s3://example-refund-artifacts/sql/unbox.mp4",
        checksum: "b".repeat(64),
        classification: "unboxing_video",
      },
      "t8",
    );
    live.attest(actor("customer"), draft.id, "t9");
    const approval = live.requestCaseApproval(
      actor("customer"),
      draft.id,
      "owned order",
      "approval-sql-platform-01",
      "t10",
    );
    live.decideCaseApproval(actor("approver"), draft.id, approval.id, "approved", "ok", "t11");
    live.submitCase(
      actor("approver"),
      draft.id,
      { idempotencyKey: "submit-sql-platform-01", provider: "manual", actionType: "manual_guidance_only" },
      "t12",
    );

    await store.saveSnapshot(live.exportSnapshot());
    const restored = Platform.fromSnapshot(await store.loadSnapshot());
    const loaded = restored.getCase(actor("customer"), draft.id);
    expect(loaded.state).toBe("submitted");
    expect(loaded.attestedBy).toBe("customer-1");
    expect(loaded.ownershipVerifiedAt).toBe("2026-08-20T10:00:00.000Z");
    expect(restored.listApprovals(actor("approver"), draft.id)[0]?.decision).toBe("approved");
    expect(restored.getSource("merchant-self-export").status).toBe("approved");
    expect(restored.listOutbox(actor("merchant_admin")).some((item) => item.eventType === "case.submitted")).toBe(
      true,
    );
  });
});
