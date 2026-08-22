import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "../src/errors.js";
import { actorFromAccessToken, oidcFromEnv, remoteJwksVerifier } from "../src/jwt.js";

const ISSUER = "https://auth.example.invalid/";
const AUDIENCE = "refund-api";
const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function sign(claims: Record<string, unknown>, expires: string | number = "10m") {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const jwk = await exportJWK(publicKey);
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "test-1" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(String(claims.sub ?? "user-1"))
    .setExpirationTime(expires)
    .sign(privateKey);
  return {
    token,
    options: {
      issuer: ISSUER,
      audience: AUDIENCE,
      getKey: async () => publicKey,
    },
    jwk,
  };
}

describe("OIDC access token", () => {
  it("maps a verified token with step-up ACR", async () => {
    const { token, options } = await sign({
      sub: "approver-1",
      tenant_id: TENANT,
      role: "approver",
      acr: "urn:refund:step-up",
    });
    const actor = await actorFromAccessToken(token, options);
    expect(actor).toMatchObject({
      id: "approver-1",
      tenantId: TENANT,
      role: "approver",
      stepUpVerified: true,
    });
  });

  it("rejects expired tokens, wrong audience and unknown roles", async () => {
    const expired = await sign(
      { sub: "a", tenant_id: TENANT, role: "customer" },
      Math.floor(Date.now() / 1000) - 120,
    );
    await expect(actorFromAccessToken(expired.token, expired.options)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );

    const { token, options } = await sign({ sub: "a", tenant_id: TENANT, role: "customer" });
    await expect(
      actorFromAccessToken(token, { ...options, audience: "other-api" }),
    ).rejects.toBeInstanceOf(UnauthorizedError);

    const badRole = await sign({ sub: "a", tenant_id: TENANT, role: "root" });
    await expect(actorFromAccessToken(badRole.token, badRole.options)).rejects.toThrow(/unknown role/);
  });

  it("verifies a token against a remote JWKS document", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
    const jwk = await exportJWK(publicKey);
    jwk.kid = "remote-1";
    jwk.alg = "RS256";
    jwk.use = "sig";
    const token = await new SignJWT({ tenant_id: TENANT, role: "auditor" })
      .setProtectedHeader({ alg: "RS256", kid: "remote-1" })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setSubject("auditor-1")
      .setExpirationTime("10m")
      .sign(privateKey);
    const previous = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ keys: [jwk] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    try {
      const actor = await actorFromAccessToken(
        token,
        remoteJwksVerifier(ISSUER, AUDIENCE, "https://auth.example.invalid/jwks"),
      );
      expect(actor).toMatchObject({ id: "auditor-1", role: "auditor" });
    } finally {
      globalThis.fetch = previous;
    }
    expect(oidcFromEnv({})).toBeUndefined();
    expect(
      oidcFromEnv({
        OIDC_ISSUER_URL: ISSUER,
        OIDC_AUDIENCE: AUDIENCE,
        OIDC_JWKS_URL: "https://auth.example.invalid/jwks",
      }),
    ).toMatchObject({ issuer: ISSUER, audience: AUDIENCE });
  });
});
