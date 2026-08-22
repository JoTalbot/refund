import { readFileSync } from "node:fs";
import { generateKeyPair, SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { ALIEXPRESS_UA_SOURCE } from "@refund/domain";
import { createHandler } from "./http.js";
import { Platform } from "./platform.js";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const exportDoc = JSON.parse(
  readFileSync(new URL("../../../fixtures/ingest/merchant-export.v1.json", import.meta.url), "utf8"),
) as unknown;

describe("API MVP", () => {
  it("completes merchant export ingest and a gated case submit", async () => {
    const platform = new Platform();
    const handle = createHandler(platform, { allowDevActor: true });
    const as =
      (role: string, id = `${role}-1`) =>
      (method: string, path: string, body: unknown = null, query: Record<string, string> = {}) =>
        handle({
          method,
          path,
          body,
          query,
          headers: {
            "x-actor-id": id,
            "x-actor-role": role,
            "x-tenant-id": TENANT,
            "x-step-up": "true",
            "x-trace-id": `trace-${role}`,
          },
        });

    const merchant = as("merchant_admin");
    const compliance = as("compliance_admin");
    const customer = as("customer");
    const approver = as("approver");
    const operator = as("operator");

    const blocked = await merchant("POST", "/v1/import-runs", {
      source_id: ALIEXPRESS_UA_SOURCE.slug,
      document: exportDoc,
      idempotency_key: "import-aliexpress-blocked1",
    });
    expect(blocked.status).toBe(200);
    expect(blocked.body).toMatchObject({ status: "blocked", errorClass: "policy_blocked" });

    const source = await merchant("POST", "/v1/sources", {
      slug: "merchant-self-export",
      owner: "demo-merchant",
      base_url: "https://merchant.example.invalid/",
      permission_basis: "Signed shop-owner JSON export",
      policy_url: "https://merchant.example.invalid/returns",
      rate_limit_per_minute: 20,
      allowed_fields: ["title", "sku", "price"],
      retention_days: 180,
    });
    const sourceId = (source.body as { id: string }).id;
    expect((await merchant("POST", `/v1/sources/${sourceId}/review`)).status).toBe(200);
    expect(((await compliance("POST", `/v1/sources/${sourceId}/approve`)).body as { status: string }).status).toBe(
      "approved",
    );

    const imported = await merchant("POST", "/v1/import-runs", {
      source_id: sourceId,
      document: exportDoc,
      idempotency_key: "import-merchant-0000001",
    });
    expect(imported.body).toMatchObject({ status: "succeeded", productsUpserted: 2 });
    const replay = await merchant("POST", "/v1/import-runs", {
      source_id: sourceId,
      document: exportDoc,
      idempotency_key: "import-merchant-0000001",
    });
    expect((replay.body as { id: string }).id).toBe((imported.body as { id: string }).id);
    expect(((await merchant("GET", "/v1/products", null, { q: "mug" })).body as { items: unknown[] }).items).toHaveLength(
      1,
    );

    const order = await customer("POST", "/v1/orders/import", {
      provider: "merchant-self",
      external_id: "ORD-1001",
      ownership_verified_at: "2026-08-20T10:00:00.000Z",
      lines: [{ sku: "SKU-MUG-1", title: "Stoneware mug 300ml", quantity: 1, amount: "12.50", currency: "EUR" }],
      idempotency_key: "order-import-00000001",
    });
    const orderId = (order.body as { id: string }).id;
    const draft = await customer("POST", "/v1/return-cases", { order_id: orderId });
    const caseId = (draft.body as { id: string }).id;
    expect(
      (
        (
          await customer("POST", `/v1/return-cases/${caseId}/eligibility`, {
            region: "UA",
            condition: "not_as_described",
            days_since_delivery: 2,
            category: "home",
            delivered: true,
          })
        ).body as { eligibility: string }
      ).eligibility,
    ).toBe("eligible");
    expect(
      (
        await customer("POST", `/v1/return-cases/${caseId}/evidence`, {
          object_uri: "s3://example-refund-artifacts/ord-1001/unbox.mp4",
          checksum: "a".repeat(64),
          classification: "unboxing_video",
        })
      ).status,
    ).toBe(201);
    expect((await customer("POST", `/v1/return-cases/${caseId}/attestations`)).status).toBe(200);

    const approval = await customer("POST", `/v1/return-cases/${caseId}/approval-requests`, {
      reason: "Buyer-owned mug is not as described",
      idempotency_key: "approval-request-00001",
    });
    const approvalId = (approval.body as { id: string }).id;
    expect(
      (
        await customer("POST", `/v1/return-cases/${caseId}/approval-requests/${approvalId}/decision`, {
          decision: "approved",
          reason: "self",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await approver("POST", `/v1/return-cases/${caseId}/approval-requests/${approvalId}/decision`, {
          decision: "approved",
          reason: "Evidence matches the owned order",
        })
      ).status,
    ).toBe(200);

    expect(
      (
        await approver("POST", `/v1/return-cases/${caseId}/submit`, {
          idempotency_key: "provider-submit-000002",
          provider: "aliexpress-ua",
          action_type: "create_return",
        })
      ).status,
    ).toBe(403);

    const submitted = await approver("POST", `/v1/return-cases/${caseId}/submit`, {
      idempotency_key: "provider-submit-000001",
      provider: "manual",
      action_type: "manual_guidance_only",
    });
    expect(submitted.status).toBe(200);
    expect(submitted.body).toMatchObject({
      case: { state: "submitted" },
      action: { status: "queued", actionType: "manual_guidance_only" },
    });
    expect(
      ((await operator("GET", "/v1/audit-events", null, { case_id: caseId })).body as { items: unknown[] }).items.length,
    ).toBeGreaterThan(0);
    expect((await handle({ method: "GET", path: "/health", headers: {}, query: {}, body: null })).body).toMatchObject({
      ok: true,
    });
    expect(
      (
        await merchant("POST", "/v1/jobs/import", {
          source_id: "aliexpress-ua",
          document: {},
          idempotency_key: "job-import-unbound-0001",
        })
      ).status,
    ).toBe(503);
    expect((await customer("GET", "/v1/me")).body).toMatchObject({ role: "customer", tenantId: TENANT });
    expect(((await customer("GET", "/v1/return-cases")).body as { items: unknown[] }).items.length).toBeGreaterThan(0);
  });

  it("accepts a verified bearer token and rejects a forged one", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const handle = createHandler(new Platform(), {
      allowDevActor: false,
      oidc: {
        issuer: "https://auth.example.invalid/",
        audience: "refund-api",
        getKey: async () => publicKey,
      },
    });
    const token = await new SignJWT({ tenant_id: TENANT, role: "auditor" })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer("https://auth.example.invalid/")
      .setAudience("refund-api")
      .setSubject("auditor-1")
      .setExpirationTime("10m")
      .sign(privateKey);

    const ok = await handle({
      method: "GET",
      path: "/v1/me",
      headers: { authorization: `Bearer ${token}` },
      query: {},
      body: null,
    });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ id: "auditor-1", role: "auditor" });

    const forged = await handle({
      method: "GET",
      path: "/v1/me",
      headers: { authorization: "Bearer not-a-jwt" },
      query: {},
      body: null,
    });
    expect(forged.status).toBe(401);
  });
});
