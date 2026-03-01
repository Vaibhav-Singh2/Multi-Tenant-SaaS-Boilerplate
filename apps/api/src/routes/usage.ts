import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { getPublicDb, usageRecords } from "@saas/database";
import { eq, gte, lte, and, count, avg, sql } from "drizzle-orm";
import { AppError } from "../middleware/errorHandler.js";

export function usageRouter(): Router {
  const router = Router();

  // GET /api/v1/usage — Tenant usage summary
  router.get(
    "/usage",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenant = req.tenant;
        if (!tenant)
          throw new AppError(401, "UNAUTHORIZED", "No tenant context");

        const db = getPublicDb();

        const { from, to } = req.query as { from?: string; to?: string };
        const periodStart = from
          ? new Date(from)
          : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const periodEnd = to ? new Date(to) : new Date();

        const conditions = [
          eq(usageRecords.tenantId, tenant.id),
          gte(usageRecords.timestamp, periodStart),
          lte(usageRecords.timestamp, periodEnd),
        ];

        const [summary] = await db
          .select({
            totalRequests: count(),
            successRequests: sql<number>`COUNT(*) FILTER (WHERE ${usageRecords.statusCode} < 400)`,
            errorRequests: sql<number>`COUNT(*) FILTER (WHERE ${usageRecords.statusCode} >= 400)`,
            avgResponseTimeMs: avg(usageRecords.responseTimeMs),
          })
          .from(usageRecords)
          .where(and(...conditions));

        res.json({
          success: true,
          data: {
            tenantId: tenant.id,
            tenantSlug: tenant.slug,
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString(),
            ...summary,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/v1/usage/records — Recent usage records
  router.get(
    "/usage/records",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenant = req.tenant;
        if (!tenant)
          throw new AppError(401, "UNAUTHORIZED", "No tenant context");

        const limit = Math.min(Number(req.query["limit"] ?? 100), 500);
        const db = getPublicDb();

        const records = await db
          .select()
          .from(usageRecords)
          .where(eq(usageRecords.tenantId, tenant.id))
          .orderBy(sql`${usageRecords.timestamp} DESC`)
          .limit(limit);

        res.json({ success: true, data: records, meta: { limit } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
