import { Queue } from "bullmq";
import type {
  WebhookJobPayload,
  EmailJobPayload,
  UsageAggregationJobPayload,
} from "@saas/types";

export function createQueues(connection: unknown) {
  const defaultJobOptions = {
    attempts: 3,
    backoff: { type: "exponential" as const, delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webhookQueue = new Queue<WebhookJobPayload, void, string>(
    "webhook-delivery",
    {
      connection: connection as any,
      defaultJobOptions,
    },
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const emailQueue = new Queue<EmailJobPayload, void, string>("email", {
    connection: connection as any,
    defaultJobOptions: { ...defaultJobOptions, attempts: 5 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usageAggregationQueue = new Queue<
    UsageAggregationJobPayload,
    void,
    string
  >("usage-aggregation", {
    connection: connection as any,
    defaultJobOptions: { ...defaultJobOptions, attempts: 2 },
  });

  return { webhookQueue, emailQueue, usageAggregationQueue };
}

export type AppQueues = ReturnType<typeof createQueues>;
