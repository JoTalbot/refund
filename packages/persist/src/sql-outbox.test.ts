import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { createOutboxEvent, markOutboxPublished } from "@refund/domain";
import { applyMigrations, defaultMigrationsDir } from "./migrate.js";
import { SqlOutboxStore } from "./sql-outbox.js";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("SQL outbox", () => {
  it("persists unpublished events and marks them published", async () => {
    const db = new PGlite();
    await applyMigrations(db, defaultMigrationsDir(), { allowMissingPgcrypto: true });
    await db.query(`INSERT INTO tenants (id, slug, name) VALUES ($1, 'demo', 'Demo')`, [TENANT]);
    const store = new SqlOutboxStore(db);
    const event = createOutboxEvent({
      tenantId: TENANT,
      aggregateType: "return_case",
      aggregateId: "case-1",
      eventType: "case.submitted",
      idempotencyKey: "outbox-sql-case-01",
      payload: { state: "submitted" },
    });
    await store.save(event);
    expect((await store.listUnpublished())[0]?.eventType).toBe("case.submitted");
    await store.save(markOutboxPublished(event, "2026-08-22T12:00:00.000Z"));
    expect(await store.listUnpublished()).toEqual([]);
    expect((await store.listAll())[0]?.publishedAt).toBe("2026-08-22T12:00:00.000Z");
  });
});
