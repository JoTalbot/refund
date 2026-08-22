import { jwtVerify, type JWTPayload } from "jose";
import { UnauthorizedError } from "./errors.js";
import { actorFromOidcClaims, type OidcClaims } from "./oidc.js";
import type { Actor } from "./types.js";

export interface OidcVerifierOptions {
  issuer: string;
  audience: string;
  getKey: (header: { kid?: string; alg?: string }) => Promise<unknown> | unknown;
  clockToleranceSec?: number;
}

export function claimsFromPayload(payload: JWTPayload): OidcClaims {
  const tenant = payload.tenant_id ?? payload.tid;
  const role = payload.role ?? payload["https://refund.invalid/role"];
  return {
    sub: String(payload.sub ?? ""),
    tenant_id: String(tenant ?? ""),
    role: String(role ?? ""),
    acr: typeof payload.acr === "string" ? payload.acr : undefined,
    amr: Array.isArray(payload.amr) ? payload.amr.map(String) : undefined,
  };
}

export async function actorFromAccessToken(
  token: string,
  options: OidcVerifierOptions,
): Promise<Actor> {
  if (!token) {
    throw new UnauthorizedError("missing bearer token");
  }
  try {
    const { payload } = await jwtVerify(
      token,
      async (header) => (await options.getKey(header)) as never,
      {
      issuer: options.issuer,
      audience: options.audience,
      clockTolerance: options.clockToleranceSec ?? 5,
    });
    return actorFromOidcClaims(claimsFromPayload(payload));
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError(`access token rejected: ${(error as Error).message}`);
  }
}
