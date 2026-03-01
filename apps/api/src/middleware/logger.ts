import type { Request, Response, NextFunction } from "express";
import type { Logger } from "@saas/logger";
import type { AppMetrics } from "@saas/logger";

export function requestLogger(logger: Logger, metrics: AppMetrics) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();

    res.on("finish", () => {
      const duration = (Date.now() - start) / 1000;
      const route = req.route?.path ?? req.path;
      const labels = {
        method: req.method,
        route,
        status_code: String(res.statusCode),
        tenant_slug:
          (req as Request & { tenant?: { slug: string } }).tenant?.slug ??
          "none",
      };

      metrics.httpRequestsTotal.inc(labels);
      metrics.httpRequestDuration.observe(
        { method: req.method, route, status_code: String(res.statusCode) },
        duration,
      );

      logger.http("Request", {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
        tenant: (req as Request & { tenant?: { slug: string } }).tenant?.slug,
      });
    });

    next();
  };
}
