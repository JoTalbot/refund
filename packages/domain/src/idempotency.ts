import { ConflictError, ValidationError } from "./errors.js";

const KEY_PATTERN = /^[A-Za-z0-9:_-]{16,128}$/;

export function assertIdempotencyKey(key: string | undefined): string {
  if (!key) {
    throw new ValidationError("idempotency_key is required for side effects");
  }
  if (!KEY_PATTERN.test(key)) {
    throw new ValidationError("idempotency_key must be 16-128 url-safe characters");
  }
  return key;
}

export class IdempotencyStore<T> {
  private readonly records = new Map<string, T>();

  remember(tenantId: string, key: string, value: T): T {
    const composite = `${tenantId}:${key}`;
    const existing = this.records.get(composite);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(value)) {
        throw new ConflictError("idempotency key reused with a different payload");
      }
      return existing;
    }
    this.records.set(composite, value);
    return value;
  }

  get(tenantId: string, key: string): T | undefined {
    return this.records.get(`${tenantId}:${key}`);
  }
}
