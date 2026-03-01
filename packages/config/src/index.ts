import { z } from "zod";

const envSchema = z.object({
  // Application
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  WORKER_PORT: z.coerce.number().default(3001),

  // Database
  DATABASE_URL: z
    .string()
    .url()
    .describe(
      "PostgreSQL connection string, e.g. postgres://user:pass@host:5432/db",
    ),

  // Redis
  REDIS_URL: z
    .string()
    .url()
    .describe("Redis connection string, e.g. redis://localhost:6379"),

  // Auth
  JWT_SECRET: z
    .string()
    .min(32)
    .describe("Secret for signing JWTs (min 32 chars)"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  // API Keys
  API_KEY_SALT_ROUNDS: z.coerce.number().default(10),

  // Rate limiting (per tenant, per window)
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000), // 1 minute
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // Observability
  LOG_LEVEL: z.enum(["error", "warn", "info", "http", "debug"]).default("info"),
  PROMETHEUS_ENABLED: z
    .string()
    .transform((v) => v === "true")
    .default("true"),

  // Admin
  ADMIN_SECRET: z.string().min(16).default("change-me-in-production"),

  // Webhooks
  WEBHOOK_SIGNATURE_SECRET: z
    .string()
    .min(16)
    .default("webhook-secret-change-me"),
  WEBHOOK_TIMEOUT_MS: z.coerce.number().default(10_000),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env;

export function getEnv(): Env {
  if (!_env) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error("❌ Invalid environment variables:");
      console.error(result.error.flatten().fieldErrors);
      throw new Error("Invalid environment configuration. See errors above.");
    }
    _env = result.data;
  }
  return _env;
}

// Re-export for convenience
export default getEnv;
