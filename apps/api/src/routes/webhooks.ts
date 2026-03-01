import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import crypto from "node:crypto";
import { getPublicDb, webhookDeliveries } from "@saas/database";
import { AppError } from "../middleware/errorHandler.js";
import type { AppQueues } from "@saas/queue";
import type { InboundWebhookPayload } from "@saas/types";

export function webhooksRouter(queues: AppQueues): Router {
  const router = Router();

  // POST /webhooks/inbound — Receive inbound webhook, enqueue delivery
  router.post(
    "/inbound",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenant = req.tenant;
        if (!tenant)
          throw new AppError(401, "UNAUTHORIZED", "No tenant context");

        const body = req.body as InboundWebhookPayload;
        if (!body.event) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            "event field is required",
          );
        }

        const db = getPublicDb();

        // Verify optional HMAC signature
        const secret = process.env["WEBHOOK_SIGNATURE_SECRET"];
        const sig = req.headers["x-webhook-signature"];
        if (secret && sig) {
          const expected = crypto
            .createHmac("sha256", secret)
            .update(JSON.stringify(body))
            .digest("hex");
          if (sig !== `sha256=${expected}`) {
            throw new AppError(
              400,
              "INVALID_SIGNATURE",
              "Webhook signature mismatch",
            );
          }
        }

        // Persist delivery record
        const [delivery] = await db
          .insert(webhookDeliveries)
          .values({
            tenantId: tenant.id,
            event: body.event,
            payload: body.data ?? {},
            targetUrl: String(req.headers["x-webhook-callback-url"] ?? ""),
            status: "pending",
          })
          .returning();

        if (!delivery)
          throw new AppError(500, "DB_ERROR", "Failed to save webhook");

        // Enqueue for async delivery
        await queues.webhookQueue.add("deliver", {
          deliveryId: delivery.id,
          tenantId: tenant.id,
          targetUrl: delivery.targetUrl,
          event: delivery.event,
          payload: delivery.payload as Record<string, unknown>,
          attempt: 0,
        });

        res.status(202).json({
          success: true,
          data: { deliveryId: delivery.id, status: "queued" },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
