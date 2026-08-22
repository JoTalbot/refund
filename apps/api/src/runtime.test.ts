import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { createRuntime } from "./runtime.js";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("API runtime boot", () => {
  it("reloads orders after a second boot on the same database", async () => {
    const db = new PGlite();
    const first = await createRuntime({ db });
    const actor = {
      id: "customer-1",
      tenantId: TENANT,
      role: "customer" as const,
      stepUpVerified: true,
    };
    const order = first.platform.importOrder(
      actor,
      {
        provider: "merchant-self",
        externalId: "ORD-BOOT-1",
        ownershipVerifiedAt: "2026-08-22T10:00:00.000Z",
        lines: [{ sku: "SKU-1", title: "Mug", quantity: 1, amount: "1.00", currency: "EUR" }],
        idempotencyKey: "order-boot-0000000001",
      },
      "boot-1",
    );
    await first.store.saveSnapshot(first.platform.exportSnapshot());

    const second = await createRuntime({ db });
    const loaded = second.platform.getOrder(actor, order.id);
    expect(loaded.externalId).toBe("ORD-BOOT-1");
    expect(second.persistence).toBe("pglite");
  });
});
