import { randomUUID } from "node:crypto";
import type { SqlJobStore } from "./sql-jobs.js";

export interface WorkflowStepResult {
  runId: string;
  ownerId: string;
  checkpointUri: string;
  output: unknown;
}

export async function runDurableStep(
  jobs: SqlJobStore,
  input: {
    runId?: string;
    jobType: string;
    ownerId: string;
    now: Date;
    ttlMs?: number;
    payload?: Record<string, unknown>;
    execute: (checkpointUri: string | null) => Promise<unknown> | unknown;
  },
): Promise<WorkflowStepResult> {
  const runId = input.runId ?? randomUUID();
  const lease = await jobs.acquire({
    runId,
    jobType: input.jobType,
    ownerId: input.ownerId,
    now: input.now,
    ttlMs: input.ttlMs,
    payload: input.payload,
  });
  const output = await input.execute(lease.checkpointUri);
  const checkpointUri = `workflow://${input.jobType}/${runId}`;
  await jobs.save({
    ...lease,
    checkpointUri,
    payload: { ...(lease.payload ?? {}), done: true },
    version: lease.version + 1,
  });
  return { runId, ownerId: lease.ownerId, checkpointUri, output };
}
