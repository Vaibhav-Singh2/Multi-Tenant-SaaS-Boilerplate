import type { Job } from "bullmq";
import { getPublicDb, usageRecords } from "@saas/database";
import { createLogger } from "@saas/logger";
import type { UsageAggregationJobPayload } from "@saas/types";
import { eq, count, avg, gte, lte, and } from "drizzle-orm";

const logger = createLogger("usage-aggregation-processor");

export async function usageAggregationProcessor(
  job: Job<UsageAggregationJobPayload>,
): Promise<void> {
  const { tenantId, periodStart, periodEnd } = job.data;
  const db = getPublicDb();

  logger.info("Running usage aggregation", {
    tenantId,
    periodStart,
    periodEnd,
  });

  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  const [summary] = await db
    .select({
      totalRequests: count(),
      avgResponseTimeMs: avg(usageRecords.responseTimeMs),
    })
    .from(usageRecords)
    .where(
      and(
        eq(usageRecords.tenantId, tenantId),
        gte(usageRecords.timestamp, start),
        lte(usageRecords.timestamp, end),
      ),
    );

  logger.info("Usage aggregation complete", {
    tenantId,
    ...summary,
    periodStart,
    periodEnd,
  });

  // Future: write aggregated stats to a summary table, push to Prometheus, etc.
}
