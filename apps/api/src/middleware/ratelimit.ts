import type { Request, Response, NextFunction } from "express";
import {
  getRedisClient,
  slidingWindowRateLimit,
  rateLimitKey,
} from "@saas/redis";
import type { AppMetrics } from "@saas/logger";

export function rateLimitMiddleware(metrics: AppMetrics) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const tenant = req.tenant;
    if (!tenant) {
      next();
      return;
    }

    const redis = getRedisClient();
    const key = rateLimitKey(tenant.id);
    const windowMs = Number(process.env["RATE_LIMIT_WINDOW_MS"] ?? 60_000);

    const result = await slidingWindowRateLimit(
      redis,
      key,
      tenant.rateLimitPerMinute,
      windowMs,
    );

    // Set standard rate-limit headers
    res.set({
      "X-RateLimit-Limit": String(result.limit),
      "X-RateLimit-Remaining": String(result.remaining),
      "X-RateLimit-Reset": String(Math.ceil(result.resetAt.getTime() / 1000)),
      "Retry-After": result.allowed
        ? undefined
        : String(Math.ceil(windowMs / 1000)),
    });

    if (!result.allowed) {
      metrics.rateLimitHitsTotal.inc({ tenant_slug: tenant.slug });
      res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: `Rate limit exceeded. You are allowed ${result.limit} requests per minute.`,
          details: {
            limit: result.limit,
            remaining: 0,
            resetAt: result.resetAt.toISOString(),
          },
        },
      });
      return;
    }

    next();
  };
}
