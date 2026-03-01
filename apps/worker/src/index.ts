import { Worker } from "bullmq";
import { getRedisClient, closeRedisClient } from "@saas/redis";
import { createLogger } from "@saas/logger";
import { webhookProcessor } from "./processors/webhookProcessor.js";
import { emailProcessor } from "./processors/emailProcessor.js";
import { usageAggregationProcessor } from "./processors/usageAggregationProcessor.js";

const logger = createLogger("worker");

async function main() {
  const redis = getRedisClient();
  await redis.ping();
  logger.info("Redis connected");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const connection = redis as any;

  const workers: Worker[] = [
    new Worker("webhook-delivery", webhookProcessor, {
      connection,
      concurrency: 10,
    }),
    new Worker("email", emailProcessor, { connection, concurrency: 5 }),
    new Worker("usage-aggregation", usageAggregationProcessor, {
      connection,
      concurrency: 2,
    }),
  ];

  workers.forEach((worker) => {
    worker.on("completed", (job) => {
      logger.info("Job completed", { queue: worker.name, jobId: job.id });
    });
    worker.on("failed", (job, err) => {
      logger.error("Job failed", {
        queue: worker.name,
        jobId: job?.id,
        error: err.message,
        attemptsMade: job?.attemptsMade,
      });
    });
  });

  logger.info("Worker started", { queues: workers.map((w) => w.name) });

  // ─── Graceful shutdown ──────────────────────────────────────────────────────
  async function shutdown(signal: string) {
    logger.info(`Received ${signal}, shutting down workers...`);
    await Promise.all(workers.map((w) => w.close()));
    await closeRedisClient();
    logger.info("Worker shutdown complete");
    process.exit(0);
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("Failed to start worker:", err);
  process.exit(1);
});
