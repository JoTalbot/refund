import { randomUUID } from "node:crypto";
import { ForbiddenError, ValidationError } from "./errors.js";
import { assertImportAllowed } from "./sources.js";
import type {
  Availability,
  ImportRun,
  Money,
  NormalizedProduct,
  ProductObservation,
  SourceRecord,
} from "./types.js";

export const MERCHANT_EXPORT_EXTRACTOR = "merchant-export@1.0.0";

export interface MerchantExportProduct {
  id: string;
  title: string;
  url: string;
  brand?: string | null;
  sku?: string | null;
  price: Money;
  availability: Availability;
}

export interface MerchantExportDocument {
  export_id: string;
  exported_at: string;
  merchant_id: string;
  consent: { granted_by: string; granted_at: string };
  products: MerchantExportProduct[];
}

export interface ParseIssue {
  index: number;
  message: string;
  class: "retryable" | "non_retryable";
}

export interface ParseResult {
  ok: boolean;
  extractorVersion: string;
  products: NormalizedProduct[];
  observations: ProductObservation[];
  issues: ParseIssue[];
}

const CURRENCY = /^[A-Z]{3}$/;
const AMOUNT = /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/;

export function parseMerchantExport(
  source: SourceRecord,
  document: unknown,
  fetchedAt: string,
): ParseResult {
  assertImportAllowed(source);
  const issues: ParseIssue[] = [];
  if (!document || typeof document !== "object") {
    return failDoc("export document must be an object");
  }
  const raw = document as Record<string, unknown>;
  if (typeof raw.export_id !== "string" || !raw.export_id) {
    issues.push({ index: -1, message: "export_id is required", class: "non_retryable" });
  }
  if (typeof raw.exported_at !== "string" || Number.isNaN(Date.parse(raw.exported_at))) {
    issues.push({ index: -1, message: "exported_at must be RFC-3339", class: "non_retryable" });
  }
  if (typeof raw.merchant_id !== "string" || !raw.merchant_id) {
    issues.push({ index: -1, message: "merchant_id is required", class: "non_retryable" });
  }
  const consent = raw.consent as Record<string, unknown> | undefined;
  if (!consent || typeof consent.granted_by !== "string" || typeof consent.granted_at !== "string") {
    issues.push({
      index: -1,
      message: "explicit merchant consent is required",
      class: "non_retryable",
    });
  }
  if (!Array.isArray(raw.products)) {
    return failDoc("products must be an array");
  }

  const products: NormalizedProduct[] = [];
  const observations: ProductObservation[] = [];

  raw.products.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      issues.push({ index, message: "product must be an object", class: "non_retryable" });
      return;
    }
    const row = item as Record<string, unknown>;
    const id = asString(row.id);
    const title = asString(row.title);
    const url = asString(row.url);
    const price = row.price as Record<string, unknown> | undefined;
    const amount = price && typeof price.amount === "string" ? price.amount : "";
    const currency = price && typeof price.currency === "string" ? price.currency : "";
    const availability = row.availability;
    if (!id || !title || !url) {
      issues.push({ index, message: "id, title and url are required", class: "non_retryable" });
      return;
    }
    if (!url.startsWith("https://")) {
      issues.push({ index, message: "canonical url must be https", class: "non_retryable" });
      return;
    }
    if (!AMOUNT.test(amount) || !CURRENCY.test(currency)) {
      issues.push({ index, message: "invalid price", class: "non_retryable" });
      return;
    }
    if (
      availability !== "in_stock" &&
      availability !== "out_of_stock" &&
      availability !== "unknown"
    ) {
      issues.push({ index, message: "invalid availability", class: "non_retryable" });
      return;
    }

    const product: NormalizedProduct = {
      id: randomUUID(),
      sourceId: source.id,
      sourceProductId: id,
      canonicalUrl: url,
      title,
      brand: typeof row.brand === "string" ? row.brand : null,
      sku: typeof row.sku === "string" ? row.sku : null,
      price: { amount, currency },
      availability,
      returnPolicySnapshotId: null,
      extractorVersion: MERCHANT_EXPORT_EXTRACTOR,
      fetchedAt,
      evidenceUri: `export://${raw.export_id ?? "unknown"}/${id}`,
      fieldConfidence: { title: 1, price: 1, availability: 1 },
    };
    products.push(product);
    observations.push({
      id: randomUUID(),
      sourceProductId: id,
      observedAt: fetchedAt,
      price: product.price,
      availability,
      evidenceUri: product.evidenceUri,
    });
  });

  if (issues.length > 0 && products.length === 0) {
    return {
      ok: false,
      extractorVersion: MERCHANT_EXPORT_EXTRACTOR,
      products: [],
      observations: [],
      issues,
    };
  }

  return {
    ok: issues.length === 0,
    extractorVersion: MERCHANT_EXPORT_EXTRACTOR,
    products,
    observations,
    issues,
  };
}

export function mergeProducts(
  existing: NormalizedProduct | undefined,
  incoming: NormalizedProduct,
): { product: NormalizedProduct; overwrite: boolean } {
  if (!existing) {
    return { product: incoming, overwrite: true };
  }
  return {
    product: {
      ...incoming,
      id: existing.id,
    },
    overwrite: true,
  };
}

export function classifyImportFailure(
  source: SourceRecord,
  error: unknown,
): Pick<ImportRun, "status" | "errorClass" | "errorMessage"> {
  try {
    assertImportAllowed(source);
  } catch (blocked) {
    return {
      status: "blocked",
      errorClass: "policy_blocked",
      errorMessage: (blocked as Error).message,
    };
  }
  if (error instanceof ForbiddenError) {
    return { status: "blocked", errorClass: "policy_blocked", errorMessage: error.message };
  }
  if (error instanceof ValidationError) {
    return { status: "failed", errorClass: "non_retryable", errorMessage: error.message };
  }
  return {
    status: "failed",
    errorClass: "retryable",
    errorMessage: error instanceof Error ? error.message : "unknown ingest error",
  };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function failDoc(message: string): ParseResult {
  return {
    ok: false,
    extractorVersion: MERCHANT_EXPORT_EXTRACTOR,
    products: [],
    observations: [],
    issues: [{ index: -1, message, class: "non_retryable" }],
  };
}
