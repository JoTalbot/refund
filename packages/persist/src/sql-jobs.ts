import {
  createLease,
  heartbeatLease,
  isLeaseExpired,
  takeoverExpiredLease,
  type JobLease,
} from "@refund/domain";
import type { SqlQuery } from "./sql.js";

export class SqlJobStore {
  constructor(private readonly db: SqlQuery) {}

  async get(runId: string): Promise<JobLease | null> {
    const result = await this.db.query<Record<string, unknown>>(
      `SELECT run_id, job_type, owner_id, expires_at, checkpoint_uri, payload, version
         FROM job_leases WHERE run_id = $1`,
      [runId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      runId: String(row.run_id),
      jobType: String(row.job_type),
      ownerId: String(row.owner_id),
      expiresAt: new Date(String(row.expires_at)).toISOString(),
      checkpointUri: row.checkpoint_uri ? String(row.checkpoint_uri) : null,
      payload: (row.payload as Record<string, unknown>) ?? {},
      version: Number(row.version),
    };
  }

  async save(lease: JobLease): Promise<void> {
    await this.db.query(
      `INSERT INTO job_leases (run_id, job_type, owner_id, expires_at, checkpoint_uri, payload, version)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
       ON CONFLICT (run_id) DO UPDATE SET
         owner_id = EXCLUDED.owner_id,
         expires_at = EXCLUDED.expires_at,
         checkpoint_uri = EXCLUDED.checkpoint_uri,
         payload = EXCLUDED.payload,
         version = EXCLUDED.version`,
      [
        lease.runId,
        lease.jobType,
        lease.ownerId,
        lease.expiresAt,
        lease.checkpointUri,
        JSON.stringify(lease.payload),
        lease.version,
      ],
    );
  }

  async acquire(input: {
    runId: string;
    jobType: string;
    ownerId: string;
    now: Date;
    ttlMs?: number;
    payload?: Record<string, unknown>;
  }): Promise<JobLease> {
    const existing = await this.get(input.runId);
    let lease: JobLease;
    if (!existing) {
      lease = createLease(input);
    } else if (isLeaseExpired(existing, input.now)) {
      lease = takeoverExpiredLease(existing, input.ownerId, input.now, input.ttlMs);
    } else {
      lease = heartbeatLease(existing, input.ownerId, input.now, input.ttlMs);
    }
    await this.save(lease);
    return lease;
  }

  async list(limit = 50): Promise<JobLease[]> {
    const result = await this.db.query<Record<string, unknown>>(
      `SELECT run_id, job_type, owner_id, expires_at, checkpoint_uri, payload, version
         FROM job_leases
        ORDER BY expires_at DESC
        LIMIT $1`,
      [limit],
    );
    return result.rows.map((row) => ({
      runId: String(row.run_id),
      jobType: String(row.job_type),
      ownerId: String(row.owner_id),
      expiresAt: new Date(String(row.expires_at)).toISOString(),
      checkpointUri: row.checkpoint_uri ? String(row.checkpoint_uri) : null,
      payload: (row.payload as Record<string, unknown>) ?? {},
      version: Number(row.version),
    }));
  }
}
