import { UnauthorizedError, ValidationError } from "./errors.js";
import { ROLES, type Actor, type Role } from "./types.js";

export interface OidcClaims {
  sub: string;
  tenant_id: string;
  role: string;
  acr?: string;
  amr?: string[];
}

const STEP_UP_MARKERS = new Set(["mfa", "hwk", "otp", "urn:refund:step-up"]);

export function actorFromOidcClaims(claims: OidcClaims): Actor {
  if (!claims.sub || !claims.tenant_id) {
    throw new UnauthorizedError("OIDC claims must include sub and tenant_id");
  }
  if (!ROLES.includes(claims.role as Role)) {
    throw new ValidationError(`unknown role claim ${claims.role}`);
  }
  const markers = [claims.acr, ...(claims.amr ?? [])].filter(Boolean) as string[];
  return {
    id: claims.sub,
    tenantId: claims.tenant_id,
    role: claims.role as Role,
    stepUpVerified: markers.some((marker) => STEP_UP_MARKERS.has(marker)),
  };
}

export function actorFromDevHeaders(headers: Record<string, string>, allow: boolean): Actor {
  if (!allow) {
    throw new UnauthorizedError("dev actor headers are disabled");
  }
  const id = header(headers, "x-actor-id");
  const tenantId = header(headers, "x-tenant-id");
  const role = header(headers, "x-actor-role");
  if (!id || !tenantId || !role) {
    throw new UnauthorizedError("x-actor-id, x-actor-role and x-tenant-id are required");
  }
  if (!ROLES.includes(role as Role)) {
    throw new ValidationError(`unknown role ${role}`);
  }
  return {
    id,
    tenantId,
    role: role as Role,
    stepUpVerified: header(headers, "x-step-up") === "true",
  };
}

function header(headers: Record<string, string>, name: string): string {
  return (headers[name] ?? headers[name.toLowerCase()] ?? "").trim();
}
