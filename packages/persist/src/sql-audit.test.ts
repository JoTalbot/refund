import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { InMemoryAuditAppender } from "@refund/domain";
import { applyMigrations, defaultMigrationsDir } from "./migrate.js";
import { SqlAuditStore } from "./sql-audit.js";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("SQL audit store", () => {
  it("appends a hash chain that can be reloaded", async () => {
    const db = new PGlite();
    await applyMigrations(db, defaultMigrationsDir(), { allowMissingPgcrypto: true });
    const store = new SqlAuditStore(db);
    const prev: string | null = await store.latestHashAsync(TENANT);
    expect(prev).toBeNull();

    const memory = {
      latestHash: (tenantId: string) => {
        if (tenantId !== TENANT) return null;
        return current;
      },
      insert: () => undefined,
    };
    let current: string | null = null;
    const appender = new InMemoryAuditAppender(memory);
    const first = appender.append({
      tenantId: TENANT,
      actorId: "operator-1",
      actorRole: "operator",
      action: "case.created",
      entityType: "return_case",
      entityId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      caseId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      after: { state: "draft" },
      traceId: "sql-1",
    });
    current = first.eventHash;
    await store.insertAsync(first);
    const second = appender.append({
      tenantId: TENANT,
      actorId: "approver-1",
      actorRole: "approver",
      action: "approval.decided",
      entityType: "approval_request",
      entityId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      caseId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      after: { decision: "approved" },
      traceId: "sql-2",
    });
    await store.insertAsync(second);

    expect(await store.latestHashAsync(TENANT)).toBe(second.eventHash);
    const loaded = await store.listByCase(TENANT, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(loaded).toHaveLength(2);
    const all = await store.listByCase(TENANT);
    expect(all[0]?.eventHash).toBe(first.eventHash);
    expect(all[1]?.prevEventHash).toBe(first.eventHash);
    expect(all[1]?.eventHash).toBe(second.eventHash);
  });
});
