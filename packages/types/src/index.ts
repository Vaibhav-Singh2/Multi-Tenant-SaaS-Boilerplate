// ─── Tenant ───────────────────────────────────────────────────────────────────
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  schemaName: string;
  isActive: boolean;
  plan: TenantPlan;
  rateLimitPerMinute: number;
  createdAt: Date;
  updatedAt: Date;
}

export type TenantPlan = "free" | "starter" | "pro" | "enterprise";

export interface CreateTenantInput {
  name: string;
  slug: string;
  plan?: TenantPlan;
  rateLimitPerMinute?: number;
}

// ─── API Keys ─────────────────────────────────────────────────────────────────
export interface ApiKey {
  id: string;
  tenantId: string;
  keyPrefix: string; // first 8 chars shown to user
  keyHash: string; // SHA-256 hash of full key (stored)
  name: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}

export interface ApiKeyWithSecret extends ApiKey {
  plainKey: string; // only returned once on creation
}

// ─── Usage ────────────────────────────────────────────────────────────────────
export interface UsageRecord {
  id: string;
  tenantId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  timestamp: Date;
}

export interface UsageSummary {
  tenantId: string;
  tenantSlug: string;
  totalRequests: number;
  successRequests: number;
  errorRequests: number;
  avgResponseTimeMs: number;
  periodStart: Date;
  periodEnd: Date;
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────
export interface WebhookDelivery {
  id: string;
  tenantId: string;
  event: string;
  payload: Record<string, unknown>;
  targetUrl: string;
  statusCode: number | null;
  responseBody: string | null;
  attemptCount: number;
  lastAttemptAt: Date | null;
  deliveredAt: Date | null;
  status: WebhookDeliveryStatus;
  createdAt: Date;
}

export type WebhookDeliveryStatus =
  | "pending"
  | "processing"
  | "delivered"
  | "failed";

export interface InboundWebhookPayload {
  event: string;
  data: Record<string, unknown>;
  timestamp?: string;
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────
export interface WebhookJobPayload {
  deliveryId: string;
  tenantId: string;
  targetUrl: string;
  event: string;
  payload: Record<string, unknown>;
  attempt: number;
}

export interface EmailJobPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tenantId?: string;
}

export interface UsageAggregationJobPayload {
  tenantId: string;
  periodStart: string; // ISO string
  periodEnd: string; // ISO string
}

// ─── Request augmentation ─────────────────────────────────────────────────────
export interface TenantContext {
  tenant: Tenant;
  apiKey: ApiKey;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;
