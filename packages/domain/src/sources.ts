import { ForbiddenError, ValidationError } from "./errors.js";
import { assertPermission, assertSameTenant } from "./rbac.js";
import type { Actor, SourceRecord, SourceStatus } from "./types.js";

export const SOURCE_TRANSITIONS: Record<SourceStatus, readonly SourceStatus[]> = {
  draft: ["review"],
  review: ["approved", "draft", "suspended"],
  approved: ["suspended"],
  suspended: ["review"],
};

export function canStartImport(source: SourceRecord): boolean {
  return source.status === "approved";
}

export function assertImportAllowed(source: SourceRecord): void {
  if (!canStartImport(source)) {
    throw new ForbiddenError(
      `import blocked: source ${source.slug} is ${source.status}, approved required`,
    );
  }
}

export function transitionSource(
  actor: Actor,
  source: SourceRecord,
  next: SourceStatus,
): SourceRecord {
  if (source.tenantId) {
    assertSameTenant(actor, source.tenantId);
  }
  if (next === "approved") {
    assertPermission(actor, "sources:approve");
  } else if (next === "review") {
    assertPermission(actor, "sources:review");
  } else if (next === "suspended") {
    assertPermission(actor, "sources:suspend");
  } else {
    assertPermission(actor, "sources:create");
  }
  if (!SOURCE_TRANSITIONS[source.status].includes(next)) {
    throw new ValidationError(`illegal source transition ${source.status} -> ${next}`);
  }
  return { ...source, status: next };
}

export function createDraftSource(input: Omit<SourceRecord, "status">): SourceRecord {
  return { ...input, status: "draft" };
}

export const ALIEXPRESS_UA_SOURCE: SourceRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "aliexpress-ua",
  owner: "platform-compliance",
  baseUrl: "https://www.aliexpress.com/",
  permissionBasis:
    "Public buyer help and official legal pages only. No API, scrape, login or cookie access.",
  policyUrl:
    "https://terms.alicdn.com/legal-agreement/terms/suit_bu1_aliexpress/suit_bu1_aliexpress201909171350_82407.html",
  status: "draft",
  rateLimitPerMinute: 0,
  allowedFields: ["public_help_url", "policy_title", "region_note"],
  retentionDays: 365,
  regionNotes:
    "Ukraine buyer self-serve guidance. Free Return / local warehouse is often unavailable.",
};

export const SHOPIFY_MERCHANT_SOURCE: SourceRecord = {
  id: "33333333-3333-4333-8333-333333333333",
  slug: "shopify-merchant",
  owner: "platform-compliance",
  baseUrl: "https://shopify.dev/docs/api/admin-graphql",
  permissionBasis:
    "Own-store Admin GraphQL only after merchant OAuth, least-privilege scopes, and Source Registry approved.",
  policyUrl: "https://shopify.dev/docs/apps/build/orders-fulfillment/returns-apps",
  status: "draft",
  rateLimitPerMinute: 0,
  allowedFields: ["shop_domain", "return_policy_url", "scopes"],
  retentionDays: 365,
  regionNotes:
    "Sandbox/draft. No Admin API client in this repository until status is approved.",
};
