import { Router, type Request, type Response } from "express";
import { getPublicSql } from "@saas/database";

export function healthRouter(): Router {
  const router = Router();

  router.get("/", async (_req: Request, res: Response) => {
    let dbOk = false;
    let redisOk = false;

    try {
      const sql = getPublicSql();
      await sql`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }

    try {
      const { getRedisClient } = await import("@saas/redis");
      await getRedisClient().ping();
      redisOk = true;
    } catch {
      redisOk = false;
    }

    const healthy = dbOk && redisOk;
    res.status(healthy ? 200 : 503).json({
      status: healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks: {
        database: dbOk ? "ok" : "error",
        redis: redisOk ? "ok" : "error",
      },
    });
  });

  return router;
}
