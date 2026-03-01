import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { createBullBoard } from "@bull-board/api";
import { getRedisClient } from "@saas/redis";
import { createLogger, createMetrics, metricsRouter } from "@saas/logger";
import { createQueues } from "@saas/queue";
import type { AppMetrics } from "@saas/logger";
import { requestLogger } from "./middleware/logger.js";
import { tenantMiddleware } from "./middleware/tenant.js";
import { rateLimitMiddleware } from "./middleware/ratelimit.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { healthRouter } from "./routes/health.js";
import { tenantsRouter } from "./routes/tenants.js";
import { usageRouter } from "./routes/usage.js";
import { webhooksRouter } from "./routes/webhooks.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      metrics?: AppMetrics;
      requestId?: string;
    }
  }
}

export function createApp(): Express {
  const app = express();
  const logger = createLogger("api");
  const metrics = createMetrics("api");
  const redis = getRedisClient();
  const queues = createQueues(redis);

  // ─── Security & Parsing ────────────────────────────────────────────────────
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  // ─── Attach metrics & logger to request ───────────────────────────────────
  app.use((req, _res, next) => {
    req.metrics = metrics;
    req.requestId = crypto.randomUUID();
    next();
  });

  // ─── Observability ─────────────────────────────────────────────────────────
  app.use(requestLogger(logger, metrics));
  app.use(metricsRouter(metrics));

  // ─── Health (unauthenticated) ──────────────────────────────────────────────
  app.use("/health", healthRouter());

  // ─── Bull Board (admin UI for queues) ─────────────────────────────────────
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");
  createBullBoard({
    queues: [
      new BullMQAdapter(queues.webhookQueue),
      new BullMQAdapter(queues.emailQueue),
      new BullMQAdapter(queues.usageAggregationQueue),
    ],
    serverAdapter,
  });
  app.use("/admin/queues", serverAdapter.getRouter());

  // ─── Admin Routes (protected by ADMIN_SECRET header) ──────────────────────
  app.use(
    "/admin/tenants",
    (req, res, next) => {
      const secret = process.env["ADMIN_SECRET"] ?? "change-me-in-production";
      if (req.headers["x-admin-secret"] !== secret) {
        res.status(401).json({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Invalid admin secret" },
        });
        return;
      }
      next();
    },
    tenantsRouter(queues),
  );

  // ─── Tenant-Scoped API Routes ──────────────────────────────────────────────
  app.use(
    "/api/v1",
    tenantMiddleware(),
    rateLimitMiddleware(metrics),
    usageRouter(),
  );
  app.use("/webhooks", tenantMiddleware(), webhooksRouter(queues));

  // ─── Global Error Handler ──────────────────────────────────────────────────
  app.use(errorHandler(logger));

  return app;
}
