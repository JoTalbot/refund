import type { SqlJobStore } from "./sql-jobs.js";
import { runDurableStep } from "./workflow.js";

export interface WorkflowHandle {
  runtime: string;
  workflowType: string;
  runId: string;
}

export interface WorkflowRuntime {
  readonly name: string;
  start(input: {
    workflowType: string;
    ownerId: string;
    runId?: string;
    payload?: Record<string, unknown>;
    now?: Date;
    ttlMs?: number;
    execute: (checkpointUri: string | null) => Promise<unknown> | unknown;
  }): Promise<WorkflowHandle>;
}

export class LeaseWorkflowRuntime implements WorkflowRuntime {
  readonly name = "lease";

  constructor(private readonly jobs: SqlJobStore) {}

  async start(input: Parameters<WorkflowRuntime["start"]>[0]): Promise<WorkflowHandle> {
    const result = await runDurableStep(this.jobs, {
      runId: input.runId,
      jobType: input.workflowType,
      ownerId: input.ownerId,
      now: input.now ?? new Date(),
      ttlMs: input.ttlMs,
      payload: input.payload,
      execute: input.execute,
    });
    return { runtime: this.name, workflowType: input.workflowType, runId: result.runId };
  }
}

export class TemporalCloudRuntime implements WorkflowRuntime {
  readonly name = "temporal";

  constructor(private readonly address: string) {
    if (!this.address) {
      throw new Error("Temporal address secret resolved empty");
    }
  }

  async start(): Promise<WorkflowHandle> {
    throw new Error(
      "Temporal Cloud client is not bound in this process; set TEMPORAL_ADDRESS_SECRET_ID and deploy the worker",
    );
  }
}

export function workflowRuntimeFromEnv(
  jobs: SqlJobStore,
  temporalAddress?: string,
): WorkflowRuntime {
  if (temporalAddress) {
    return new TemporalCloudRuntime(temporalAddress);
  }
  return new LeaseWorkflowRuntime(jobs);
}
