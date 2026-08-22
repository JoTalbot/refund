import { runDurableStep, type SqlJobStore } from "@refund/persist";
import type { Platform } from "./platform.js";
import type { Actor } from "@refund/domain";

export async function runImportWorkflow(
  platform: Platform,
  jobs: SqlJobStore,
  input: {
    actor: Actor;
    sourceId: string;
    document: unknown;
    idempotencyKey: string;
    ownerId: string;
    runId?: string;
    now?: Date;
    ttlMs?: number;
    traceId: string;
  },
) {
  return runDurableStep(jobs, {
    runId: input.runId,
    jobType: "import.merchant_export",
    ownerId: input.ownerId,
    now: input.now ?? new Date(),
    ttlMs: input.ttlMs,
    payload: { sourceId: input.sourceId, idempotencyKey: input.idempotencyKey },
    execute: () =>
      platform.importMerchantExport(
        input.actor,
        {
          sourceId: input.sourceId,
          document: input.document,
          idempotencyKey: input.idempotencyKey,
        },
        input.traceId,
      ),
  });
}
