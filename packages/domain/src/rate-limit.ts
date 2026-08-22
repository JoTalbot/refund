import { RateLimitError } from "./errors.js";

export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly windowMs = 60_000) {}

  tryAcquire(key: string, limit: number, now = Date.now()): boolean {
    if (limit <= 0) return true;
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((stamp) => stamp > cutoff);
    if (recent.length >= limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  acquireOrThrow(key: string, limit: number, now = Date.now(), label = key): void {
    if (!this.tryAcquire(key, limit, now)) {
      throw new RateLimitError(`rate limit exceeded for ${label}: ${limit}/min`);
    }
  }
}
