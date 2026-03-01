import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Redis } from "ioredis";
import { slidingWindowRateLimit, rateLimitKey } from "../ratelimit.js";
import { startRedisContainer, type StartedRedisContainer } from "@saas/testing";

let redisContainer: StartedRedisContainer;
let redis: Redis;

beforeAll(async () => {
  redisContainer = await startRedisContainer();
  redis = new Redis(redisContainer.connectionString);
}, 60_000);

afterAll(async () => {
  await redis.quit();
  await redisContainer.container.stop();
});

describe("slidingWindowRateLimit", () => {
  it("should allow requests within the limit", async () => {
    const key = "rl:test-allowed";
    for (let i = 0; i < 5; i++) {
      const result = await slidingWindowRateLimit(redis, key, 10, 60_000);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    }
  });

  it("should block requests exceeding the limit", async () => {
    const key = "rl:test-block";
    for (let i = 0; i < 3; i++) {
      await slidingWindowRateLimit(redis, key, 3, 60_000);
    }
    const result = await slidingWindowRateLimit(redis, key, 3, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("should set correct limit value", async () => {
    const key = "rl:test-limit-value";
    const result = await slidingWindowRateLimit(redis, key, 42, 60_000);
    expect(result.limit).toBe(42);
  });

  it("should provide a future resetAt date", async () => {
    const key = "rl:test-reset";
    const result = await slidingWindowRateLimit(redis, key, 10, 60_000);
    expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("rateLimitKey", () => {
  it("should produce consistent keys", () => {
    expect(rateLimitKey("tenant-123")).toBe("rl:tenant-123");
  });
});
