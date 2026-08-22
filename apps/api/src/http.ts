import {
  UnauthorizedError,
  actorFromAccessToken,
  actorFromDevHeaders,
  type Actor,
  type OidcVerifierOptions,
} from "@refund/domain";
import type { SqlJobStore, SqlPlatformStore } from "@refund/persist";
import type { Platform } from "./platform.js";
import { runImportWorkflow } from "./worker.js";

export interface ApiRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

const UUID = "[0-9a-fA-F-]{36}";

export function createHandler(
  platform: Platform,
  options: {
    allowDevActor: boolean;
    oidc?: OidcVerifierOptions;
    persistence?: string;
    store?: SqlPlatformStore;
    jobs?: SqlJobStore;
  },
) {
  return async function handle(request: ApiRequest): Promise<ApiResponse> {
    try {
      const result = await route(platform, request, options);
      if (options.store && request.method.toUpperCase() === "POST" && result.status < 400) {
        await options.store.saveSnapshot(platform.exportSnapshot());
      }
      return result;
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return json(401, { error: error.code, message: error.message });
      }
      if (platform.isDomainError(error)) {
        const status =
          error.code === "not_found" ? 404 : error.code === "conflict" ? 409 : error.code === "forbidden" ? 403 : 400;
        return json(status, { error: error.code, message: error.message });
      }
      return json(500, { error: "internal", message: "unexpected error" });
    }
  };
}

async function route(
  platform: Platform,
  request: ApiRequest,
  options: {
    allowDevActor: boolean;
    oidc?: OidcVerifierOptions;
    persistence?: string;
    jobs?: SqlJobStore;
  },
): Promise<ApiResponse> {
  const method = request.method.toUpperCase();
  const path = normalizePath(request.path);

  if (method === "GET" && path === "/health") {
    return json(200, {
      ok: true,
      service: "refund-api",
      persistence: options.persistence ?? "memory",
    });
  }
  if (method === "GET" && path === "/v1/meta") {
    return json(200, {
      version: "0.5.0",
      providerConnectors: [],
      persistence: options.persistence ?? "memory",
      oidc: Boolean(options.oidc),
    });
  }

  const actor = await resolveActor(request.headers, options);
  const traceId = header(request.headers, "x-trace-id") || "trace-local";

  if (method === "GET" && path === "/v1/me") {
    return json(200, actor);
  }

  if (method === "POST" && path === "/v1/jobs/import") {
    if (!options.jobs) {
      return json(503, { error: "jobs_unavailable", message: "job runtime is not bound" });
    }
    const body = asRecord(request.body);
    const result = await runImportWorkflow(platform, options.jobs, {
      actor,
      sourceId: String(body.source_id ?? ""),
      document: body.document,
      idempotencyKey: String(body.idempotency_key ?? header(request.headers, "idempotency-key")),
      ownerId: actor.id,
      traceId,
    });
    return json(202, result);
  }

  if (method === "GET" && path === "/v1/sources") {
    return json(200, { items: platform.listSources(actor) });
  }

  const sourceApprove = match(path, `^/v1/sources/([^/]+)/approve$`);
  if (method === "POST" && sourceApprove) {
    return json(200, platform.approveSource(actor, sourceApprove[1] ?? "", traceId));
  }
  const sourceReview = match(path, `^/v1/sources/([^/]+)/review$`);
  if (method === "POST" && sourceReview) {
    return json(200, platform.reviewSource(actor, sourceReview[1] ?? "", traceId));
  }
  const sourceOne = match(path, `^/v1/sources/([^/]+)$`);
  if (method === "GET" && sourceOne) {
    const source = platform.getSource(sourceOne[1] ?? "");
    return json(200, { ...source, importAllowed: platform.sourceImportAllowed(source.id) });
  }
  if (method === "POST" && path === "/v1/sources") {
    const body = asRecord(request.body);
    return json(
      201,
      platform.createSource(
        actor,
        {
          slug: String(body.slug ?? ""),
          owner: String(body.owner ?? actor.id),
          baseUrl: String(body.base_url ?? ""),
          permissionBasis: String(body.permission_basis ?? ""),
          policyUrl: String(body.policy_url ?? ""),
          rateLimitPerMinute: Number(body.rate_limit_per_minute ?? 0),
          allowedFields: Array.isArray(body.allowed_fields) ? body.allowed_fields.map(String) : [],
          retentionDays: Number(body.retention_days ?? 30),
          regionNotes: body.region_notes ? String(body.region_notes) : "",
        },
        traceId,
      ),
    );
  }

  if (method === "POST" && path === "/v1/import-runs") {
    const body = asRecord(request.body);
    return json(
      200,
      platform.importMerchantExport(
        actor,
        {
          sourceId: String(body.source_id ?? ""),
          document: body.document,
          idempotencyKey: String(body.idempotency_key ?? header(request.headers, "idempotency-key")),
        },
        traceId,
      ),
    );
  }

  if (method === "GET" && path === "/v1/products") {
    return json(200, {
      items: platform.searchProducts(actor, request.query.source_id, request.query.q),
    });
  }

  if (method === "GET" && path === "/v1/orders") {
    return json(200, { items: platform.listOrders(actor) });
  }

  if (method === "POST" && path === "/v1/orders/import") {
    const body = asRecord(request.body);
    const lines = Array.isArray(body.lines) ? body.lines : [];
    return json(
      201,
      platform.importOrder(
        actor,
        {
          provider: String(body.provider ?? ""),
          externalId: String(body.external_id ?? ""),
          ownershipVerifiedAt: body.ownership_verified_at ? String(body.ownership_verified_at) : null,
          piiRef: body.pii_ref ? String(body.pii_ref) : null,
          lines: lines.map((line) => {
            const row = asRecord(line);
            return {
              sku: row.sku ? String(row.sku) : null,
              title: String(row.title ?? ""),
              quantity: Number(row.quantity ?? 1),
              amount: String(row.amount ?? "0"),
              currency: String(row.currency ?? "EUR"),
            };
          }),
          idempotencyKey: String(body.idempotency_key ?? header(request.headers, "idempotency-key")),
        },
        traceId,
      ),
    );
  }

  const orderOne = match(path, `^/v1/orders/(${UUID})$`);
  if (method === "GET" && orderOne) {
    return json(200, platform.getOrder(actor, orderOne[1] ?? ""));
  }

  if (method === "GET" && path === "/v1/import-runs") {
    return json(200, { items: platform.listImports(actor) });
  }

  if (method === "GET" && path === "/v1/return-cases") {
    return json(200, { items: platform.listCases(actor) });
  }

  if (method === "POST" && path === "/v1/return-cases") {
    const body = asRecord(request.body);
    return json(201, platform.createCase(actor, { orderId: String(body.order_id ?? "") }, traceId));
  }

  const caseElig = match(path, `^/v1/return-cases/(${UUID})/eligibility$`);
  if (method === "POST" && caseElig) {
    const body = asRecord(request.body);
    return json(
      200,
      platform.evaluateCase(
        actor,
        caseElig[1] ?? "",
        {
          region: body.region ? String(body.region) : undefined,
          condition: body.condition ? String(body.condition) : undefined,
          daysSinceDelivery:
            body.days_since_delivery === undefined ? undefined : Number(body.days_since_delivery),
          category: body.category ? String(body.category) : undefined,
          delivered: typeof body.delivered === "boolean" ? body.delivered : undefined,
        },
        traceId,
      ),
    );
  }

  const caseAttest = match(path, `^/v1/return-cases/(${UUID})/attestations$`);
  if (method === "POST" && caseAttest) {
    return json(200, platform.attest(actor, caseAttest[1] ?? "", traceId));
  }

  const caseEvidence = match(path, `^/v1/return-cases/(${UUID})/evidence$`);
  if (method === "POST" && caseEvidence) {
    const body = asRecord(request.body);
    return json(
      201,
      platform.addEvidence(
        actor,
        caseEvidence[1] ?? "",
        {
          objectUri: String(body.object_uri ?? ""),
          checksum: String(body.checksum ?? ""),
          classification: String(body.classification ?? "unspecified"),
          expiresAt: body.expires_at ? String(body.expires_at) : null,
        },
        traceId,
      ),
    );
  }

  const caseDecision = match(path, `^/v1/return-cases/(${UUID})/approval-requests/(${UUID})/decision$`);
  if (method === "POST" && caseDecision) {
    const body = asRecord(request.body);
    const decision = body.decision === "rejected" ? "rejected" : "approved";
    return json(
      200,
      platform.decideCaseApproval(
        actor,
        caseDecision[1] ?? "",
        caseDecision[2] ?? "",
        decision,
        String(body.reason ?? ""),
        traceId,
      ),
    );
  }

  const caseApproval = match(path, `^/v1/return-cases/(${UUID})/approval-requests$`);
  if (method === "GET" && caseApproval) {
    return json(200, { items: platform.listApprovals(actor, caseApproval[1] ?? "") });
  }
  if (method === "POST" && caseApproval) {
    const body = asRecord(request.body);
    return json(
      201,
      platform.requestCaseApproval(
        actor,
        caseApproval[1] ?? "",
        String(body.reason ?? ""),
        String(body.idempotency_key ?? header(request.headers, "idempotency-key")),
        traceId,
      ),
    );
  }

  const caseSubmit = match(path, `^/v1/return-cases/(${UUID})/submit$`);
  if (method === "POST" && caseSubmit) {
    const body = asRecord(request.body);
    return json(
      200,
      platform.submitCase(
        actor,
        caseSubmit[1] ?? "",
        {
          idempotencyKey: String(body.idempotency_key ?? header(request.headers, "idempotency-key")),
          provider: String(body.provider ?? "manual"),
          actionType: String(body.action_type ?? "manual_guidance_only"),
        },
        traceId,
      ),
    );
  }

  const caseOne = match(path, `^/v1/return-cases/(${UUID})$`);
  if (method === "GET" && caseOne) {
    return json(200, platform.getCase(actor, caseOne[1] ?? ""));
  }

  if (method === "GET" && path === "/v1/audit-events") {
    return json(200, { items: platform.listAudit(actor, request.query.case_id) });
  }

  return json(404, { error: "not_found" });
}

async function resolveActor(
  headers: Record<string, string>,
  options: { allowDevActor: boolean; oidc?: OidcVerifierOptions },
): Promise<Actor> {
  const normalized = normalizeHeaders(headers);
  const authorization = normalized.authorization ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    if (!options.oidc) {
      throw new UnauthorizedError("bearer tokens require OIDC configuration");
    }
    return actorFromAccessToken(authorization.slice(7).trim(), options.oidc);
  }
  return actorFromDevHeaders(normalized, options.allowDevActor);
}

function normalizeHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key.toLowerCase()] = value;
  }
  return out;
}

function header(headers: Record<string, string>, name: string): string {
  return normalizeHeaders(headers)[name] ?? "";
}

function normalizePath(path: string): string {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/";
}

function match(path: string, pattern: string): RegExpMatchArray | null {
  return path.match(new RegExp(pattern));
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function json(status: number, body: unknown): ApiResponse {
  return { status, body };
}
