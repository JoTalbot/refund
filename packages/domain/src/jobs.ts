import { ConflictError, ValidationError } from "./errors.js";
import type { JobLease } from "./types.js";

export const DEFAULT_LEASE_TTL_MS = 60_000;

export function createLease(input: {
  runId: string;
  jobType: string;
  ownerId: string;
  now: Date;
  ttlMs?: number;
  checkpointUri?: string | null;
  payload?: Record<string, unknown>;
}): JobLease {
  if (!input.ownerId) {
    throw new ValidationError("lease owner is required");
  }
  const ttl = input.ttlMs ?? DEFAULT_LEASE_TTL_MS;
  return {
    runId: input.runId,
    jobType: input.jobType,
    ownerId: input.ownerId,
    expiresAt: new Date(input.now.getTime() + ttl).toISOString(),
    checkpointUri: input.checkpointUri ?? null,
    payload: input.payload ?? {},
    version: 1,
  };
}

export function isLeaseExpired(lease: JobLease, now: Date): boolean {
  return Date.parse(lease.expiresAt) <= now.getTime();
}

export function heartbeatLease(lease: JobLease, ownerId: string, now: Date, ttlMs?: number): JobLease {
  if (lease.ownerId !== ownerId && !isLeaseExpired(lease, now)) {
    throw new ConflictError("lease is owned by another worker");
  }
  const ttl = ttlMs ?? DEFAULT_LEASE_TTL_MS;
  return {
    ...lease,
    ownerId,
    expiresAt: new Date(now.getTime() + ttl).toISOString(),
    version: lease.version + 1,
  };
}

export function takeoverExpiredLease(
  lease: JobLease,
  newOwnerId: string,
  now: Date,
  ttlMs?: number,
): JobLease {
  if (!isLeaseExpired(lease, now)) {
    throw new ConflictError("cannot take over a live lease");
  }
  return heartbeatLease(lease, newOwnerId, now, ttlMs);
}

export function checkpointLease(lease: JobLease, ownerId: string, checkpointUri: string): JobLease {
  if (lease.ownerId !== ownerId) {
    throw new ConflictError("only the lease owner may write a checkpoint");
  }
  return { ...lease, checkpointUri, version: lease.version + 1 };
}
