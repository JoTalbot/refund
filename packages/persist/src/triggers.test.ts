import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { applyMigrations, defaultMigrationsDir } from "./migrate.js";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function migrated() {
  const db = new PGlite();
  const applied = await applyMigrations(db, defaultMigrationsDir(), { allowMissingPgcrypto: true });
  await db.exec(`
    INSERT INTO tenants (id, slug, name) VALUES ('${TENANT}', 'demo', 'Demo tenant');
    INSERT INTO actors (id, tenant_id, external_subject, role)
    VALUES
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '${TENANT}', 'customer-1', 'customer'),
      ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '${TENANT}', 'approver-1', 'approver');
    INSERT INTO orders (id, tenant_id, provider, external_id, ownership_verified_at)
    VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '${TENANT}', 'merchant-self', 'ORD-1', now());
    INSERT INTO return_cases (id, tenant_id, order_id, state, eligibility, version)
    VALUES (
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      '${TENANT}',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'approved_for_submission',
      'eligible',
      4
    );
  `);
  return { db, applied };
}

describe("postgres migrations and constraints", () => {
  it("applies all migrations and keeps AliExpress draft", async () => {
    const { applied, db } = await migrated();
    expect(applied).toEqual([
      "0001_foundation.sql",
      "0002_audit_append_only.sql",
      "0003_jobs_and_import_runs.sql",
      "0004_order_lines_and_policy.sql",
    ]);
    const sources = await db.query<{ slug: string; status: string }>(
      "SELECT slug, status FROM sources WHERE slug = 'aliexpress-ua'",
    );
    expect(sources.rows[0]).toEqual({ slug: "aliexpress-ua", status: "draft" });
    const tables = await db.query<{ relname: string }>(
      "SELECT relname FROM pg_class WHERE relname IN ('audit_events', 'approval_requests', 'provider_actions', 'job_leases')",
    );
    expect(tables.rows.map((row) => row.relname).sort()).toEqual([
      "approval_requests",
      "audit_events",
      "job_leases",
      "provider_actions",
    ]);
  });

  it("enforces two-person control on approval_requests", async () => {
    const { db } = await migrated();
    await expect(
      db.query(
        `INSERT INTO approval_requests (
          id, tenant_id, case_id, requested_by, approved_by, decision, reason, policy_version, idempotency_key
        ) VALUES (
          'ffffffff-ffff-4fff-8fff-ffffffffffff',
          '${TENANT}',
          'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          'approved',
          'self',
          'v1',
          'approval-request-sql-01'
        )`,
      ),
    ).rejects.toThrow();
  });
});
