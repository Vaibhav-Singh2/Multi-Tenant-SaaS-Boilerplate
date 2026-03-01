import type { Redis } from "ioredis";

export async function cacheGet<T>(
  redis: Redis,
  key: string,
): Promise<T | null> {
  const val = await redis.get(key);
  if (!val) return null;
  try {
    return JSON.parse(val) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(
  redis: Redis,
  key: string,
  value: unknown,
  ttlSeconds = 60,
): Promise<void> {
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
}

export async function cacheDel(redis: Redis, key: string): Promise<void> {
  await redis.del(key);
}

export async function cacheGetOrSet<T>(
  redis: Redis,
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 60,
): Promise<T> {
  const cached = await cacheGet<T>(redis, key);
  if (cached !== null) return cached;
  const value = await fetcher();
  await cacheSet(redis, key, value, ttlSeconds);
  return value;
}
