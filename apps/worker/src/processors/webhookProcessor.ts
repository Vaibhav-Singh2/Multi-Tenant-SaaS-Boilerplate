import type { Job } from "bullmq";
import { getPublicDb, webhookDeliveries } from "@saas/database";
import { createLogger } from "@saas/logger";
import type { WebhookJobPayload } from "@saas/types";
import { eq } from "drizzle-orm";

const logger = createLogger("webhook-processor");

export async function webhookProcessor(
  job: Job<WebhookJobPayload>,
): Promise<void> {
  const { deliveryId, targetUrl, event, payload, attempt } = job.data;
  const db = getPublicDb();

  logger.info("Processing webhook delivery", {
    deliveryId,
    event,
    targetUrl,
    attempt,
  });

  if (!targetUrl) {
    logger.warn("No targetUrl provided, skipping delivery", { deliveryId });
    await db
      .update(webhookDeliveries)
      .set({ status: "failed" })
      .where(eq(webhookDeliveries.id, deliveryId));
    return;
  }

  const timeoutMs = Number(process.env["WEBHOOK_TIMEOUT_MS"] ?? 10_000);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": event,
        "X-Delivery-Id": deliveryId,
        "User-Agent": "SaaS-Webhook/1.0",
      },
      body: JSON.stringify({
        event,
        data: payload,
        deliveredAt: new Date().toISOString(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseBody = await response.text().catch(() => "");

    await db
      .update(webhookDeliveries)
      .set({
        statusCode: response.status,
        responseBody: responseBody.slice(0, 2000),
        attemptCount: attempt + 1,
        lastAttemptAt: new Date(),
        deliveredAt: response.ok ? new Date() : null,
        status: response.ok ? "delivered" : "failed",
      })
      .where(eq(webhookDeliveries.id, deliveryId));

    if (!response.ok) {
      throw new Error(`Webhook delivery failed with status ${response.status}`);
    }

    logger.info("Webhook delivered successfully", {
      deliveryId,
      statusCode: response.status,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    logger.error("Webhook delivery error", {
      deliveryId,
      error: (err as Error).message,
    });

    await db
      .update(webhookDeliveries)
      .set({
        attemptCount: attempt + 1,
        lastAttemptAt: new Date(),
        status: "failed",
      })
      .where(eq(webhookDeliveries.id, deliveryId));

    throw err; // Re-throw so BullMQ handles retry with backoff
  }
}
