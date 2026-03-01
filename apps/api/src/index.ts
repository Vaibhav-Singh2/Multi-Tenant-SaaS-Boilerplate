import { getEnv } from "@saas/config";
import { createLogger } from "@saas/logger";
import { getRedisClient, closeRedisClient } from "@saas/redis";
import { getPublicSql } from "@saas/database";
import { createApp } from "./app.js";

const logger = createLogger("api");

async function main() {
  const env = getEnv();

  // Verify Redis connection
  const redis = getRedisClient();
  await redis.ping();
  logger.info("Redis connected");

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`API server listening on port ${env.PORT}`, {
      port: env.PORT,
      env: env.NODE_ENV,
    });
  });

  // ─── Graceful shutdown ──────────────────────────────────────────────────────
  async function shutdown(signal: string) {
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    server.close(async () => {
      try {
        await closeRedisClient();
        await getPublicSql().end();
        logger.info("Graceful shutdown complete");
        process.exit(0);
      } catch (err) {
        logger.error("Error during shutdown", { error: err });
        process.exit(1);
      }
    });

    // Force shutdown after 10s
    setTimeout(() => {
      logger.error("Graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, 10_000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("Failed to start API server:", err);
  process.exit(1);
});
