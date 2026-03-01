import winston from "winston";
import { Router, type Request, type Response } from "express";
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from "prom-client";

// ─── Winston Logger ────────────────────────────────────────────────────────────

const { combine, timestamp, json, colorize, simple, errors } = winston.format;

export function createLogger(service: string) {
  const isDev = process.env["NODE_ENV"] !== "production";

  return winston.createLogger({
    level: process.env["LOG_LEVEL"] ?? "info",
    defaultMeta: { service },
    format: combine(
      errors({ stack: true }),
      timestamp(),
      isDev ? combine(colorize(), simple()) : json(),
    ),
    transports: [new winston.transports.Console()],
  });
}

export type Logger = ReturnType<typeof createLogger>;

// ─── Prometheus Metrics ────────────────────────────────────────────────────────

export interface AppMetrics {
  registry: Registry;
  httpRequestsTotal: Counter;
  httpRequestDuration: Histogram;
  rateLimitHitsTotal: Counter;
  webhookJobsTotal: Counter;
  activeTenantsGauge: import("prom-client").Gauge;
}

export function createMetrics(service: string): AppMetrics {
  const registry = new Registry();
  registry.setDefaultLabels({ service });
  collectDefaultMetrics({ register: registry });

  const httpRequestsTotal = new Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests",
    labelNames: ["method", "route", "status_code", "tenant_slug"],
    registers: [registry],
  });

  const httpRequestDuration = new Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    registers: [registry],
  });

  const rateLimitHitsTotal = new Counter({
    name: "rate_limit_hits_total",
    help: "Total number of rate limit rejections",
    labelNames: ["tenant_slug"],
    registers: [registry],
  });

  const webhookJobsTotal = new Counter({
    name: "webhook_jobs_total",
    help: "Total number of webhook delivery jobs",
    labelNames: ["status"],
    registers: [registry],
  });

  const activeTenantsGauge = new Gauge({
    name: "active_tenants_total",
    help: "Number of active tenants",
    registers: [registry],
  });

  return {
    registry,
    httpRequestsTotal,
    httpRequestDuration,
    rateLimitHitsTotal,
    webhookJobsTotal,
    activeTenantsGauge,
  };
}

// ─── Metrics Express Router ───────────────────────────────────────────────────

export function metricsRouter(metrics: AppMetrics): Router {
  const router = Router();

  router.get("/metrics", async (_req: Request, res: Response) => {
    res.set("Content-Type", metrics.registry.contentType);
    res.end(await metrics.registry.metrics());
  });

  return router;
}
