import { describe, expect, it } from "vitest";
import { isPostgresUrl, PgSqlQuery } from "./pg-driver.js";

describe("postgres driver adapter", () => {
  it("delegates parameterized queries and recognizes postgres URLs", async () => {
    const calls: unknown[] = [];
    const adapter = new PgSqlQuery({
      query: async (sql, params) => {
        calls.push({ sql, params });
        return { rows: [{ id: "1" }] };
      },
    });
    const result = await adapter.query("SELECT 1", [1]);
    expect(result.rows[0]).toEqual({ id: "1" });
    await adapter.exec("SELECT 2");
    expect(calls).toHaveLength(2);
    expect(isPostgresUrl("postgres://localhost/refund")).toBe(true);
    expect(isPostgresUrl("https://example.invalid")).toBe(false);
  });
});
