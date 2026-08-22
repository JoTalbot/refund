import { ValidationError } from "./errors.js";
import type { CaseEvidence, EvidenceClassification } from "./types.js";

export const EVIDENCE_CLASSIFICATIONS: readonly EvidenceClassification[] = [
  "unboxing_video",
  "photo",
  "receipt",
  "correspondence",
  "other",
];

export function assertEvidenceUri(uri: string): string {
  if (!uri.startsWith("s3://") && !uri.startsWith("https://")) {
    throw new ValidationError("evidence must be an object-storage or https URI");
  }
  if (/\s/.test(uri) || uri.includes("..")) {
    throw new ValidationError("evidence URI is malformed");
  }
  return uri;
}

export function assertChecksum(checksum: string): string {
  if (!/^[a-f0-9]{64}$/i.test(checksum)) {
    throw new ValidationError("checksum must be sha-256 hex");
  }
  return checksum.toLowerCase();
}

export function parseEvidenceClassification(value: string): EvidenceClassification {
  if ((EVIDENCE_CLASSIFICATIONS as readonly string[]).includes(value)) {
    return value as EvidenceClassification;
  }
  throw new ValidationError(`unknown evidence classification ${value}`);
}

export function createEvidenceRecord(input: {
  id: string;
  caseId: string;
  objectUri: string;
  checksum: string;
  classification: string;
  expiresAt?: string | null;
  legalHold?: boolean;
}): CaseEvidence {
  return {
    id: input.id,
    caseId: input.caseId,
    objectUri: assertEvidenceUri(input.objectUri),
    checksum: assertChecksum(input.checksum),
    classification: parseEvidenceClassification(input.classification),
    expiresAt: input.expiresAt ?? null,
    legalHold: Boolean(input.legalHold),
    erasedAt: null,
  };
}
