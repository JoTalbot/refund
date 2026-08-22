import { describe, expect, it } from "vitest";
import { EnvSecretResolver, resolveDatabaseUrl } from "@refund/persist";
import { assertManagedPostgresBinding } from "./bind.js";

describe("managed Postgres secret path", () => {
  it("resolves the DSN from the secret id and fails closed when unbound", async () => {
    const env = {
      DATABASE_URL_SECRET_ID: "refund/dev/database-url",
      DATABASE_URL: "postgres://alice:supersecret@db.example.invalid:5432/refund",
    };
    const url = await resolveDatabaseUrl(new EnvSecretResolver(env), env);
    expect(url?.startsWith("postgres://")).toBe(true);
    expect(() => assertManagedPostgresBinding(url, {})).toThrow(/pg pool is not bound/);
    expect(() => assertManagedPostgresBinding(url, { sql: {} })).not.toThrow();
  });
});
