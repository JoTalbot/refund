import { describe, expect, it } from "vitest";
import { EnvSecretResolver, redactSecret, resolveDatabaseUrl } from "./secrets.js";

describe("secret resolver", () => {
  it("resolves DATABASE_URL only through the configured secret id", async () => {
    const secrets = new EnvSecretResolver({
      DATABASE_URL_SECRET_ID: "refund/dev/database-url",
      DATABASE_URL: "postgres://alice:supersecret@db.example.invalid:5432/refund",
    });
    const url = await resolveDatabaseUrl(secrets, {
      DATABASE_URL_SECRET_ID: "refund/dev/database-url",
      DATABASE_URL: "postgres://alice:supersecret@db.example.invalid:5432/refund",
    });
    expect(url).toContain("db.example.invalid");
    expect(redactSecret(url ?? "")).toBe("postgres://alice:***@db.example.invalid:5432/refund");
    expect(
      await resolveDatabaseUrl(new EnvSecretResolver({}), { DATABASE_URL_SECRET_ID: "missing" }),
    ).toBeUndefined();
  });
});
