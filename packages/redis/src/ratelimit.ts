import type { Redis } from "ioredis";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

/**
 * Sliding window rate limiter using Redis sorted sets.
 *
 * Algorithm:
 *  1. Remove entries older than `windowMs`
 *  2. Count current entries → if >= max, reject
 *  3. Add current timestamp as new entry
 *  4. Set TTL on the key
 */
export async function slidingWindowRateLimit(
  redis: Redis,
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - windowMs;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, 0, windowStart);
  pipeline.zcard(key);
  pipeline.zadd(key, now, `${now}-${Math.random()}`);
  pipeline.pexpire(key, windowMs);

  const results = await pipeline.exec();
  // results[1] is the zcard result (before we added the new entry)
  const count = (results?.[1]?.[1] as number) ?? 0;

  const allowed = count < limit;
  const remaining = Math.max(0, limit - count - (allowed ? 1 : 0));
  const resetAt = new Date(now + windowMs);

  return { allowed, remaining, resetAt, limit };
}

/**
 * Builds the Redis key for a tenant's rate limit window.
 */
export function rateLimitKey(tenantId: string): string {
  return `rl:${tenantId}`;
}
