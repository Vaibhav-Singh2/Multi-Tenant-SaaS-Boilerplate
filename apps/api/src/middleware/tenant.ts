import type { Request, Response, NextFunction } from "express";
import { getPublicDb } from "@saas/database";
import { apiKeys, tenants } from "@saas/database";
import { hashApiKey } from "@saas/auth";
import { eq, and } from "drizzle-orm";
import type { Tenant, ApiKey } from "@saas/types";

// Augment Express Request with tenant context
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenant?: Tenant;
      apiKey?: ApiKey;
    }
  }
}

export function tenantMiddleware() {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const rawKey = req.headers["x-api-key"];

    if (!rawKey || typeof rawKey !== "string") {
      res.status(401).json({
        success: false,
        error: {
          code: "MISSING_API_KEY",
          message: "X-API-Key header is required",
        },
      });
      return;
    }

    const keyHash = hashApiKey(rawKey);
    const db = getPublicDb();

    const result = await db
      .select({
        apiKey: apiKeys,
        tenant: tenants,
      })
      .from(apiKeys)
      .innerJoin(tenants, eq(apiKeys.tenantId, tenants.id))
      .where(
        and(
          eq(apiKeys.keyHash, keyHash),
          eq(apiKeys.isActive, true),
          eq(tenants.isActive, true),
        ),
      )
      .limit(1);

    if (result.length === 0) {
      res.status(401).json({
        success: false,
        error: {
          code: "INVALID_API_KEY",
          message: "The provided API key is invalid or has been revoked",
        },
      });
      return;
    }

    const { tenant, apiKey } = result[0]!;

    // Update last used timestamp asynchronously (non-blocking)
    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, apiKey.id))
      .catch(() => {
        /* non-critical */
      });

    req.tenant = {
      ...tenant,
      plan: tenant.plan as Tenant["plan"],
      isActive: tenant.isActive,
      schemaName: tenant.schemaName,
    } satisfies Tenant;

    req.apiKey = {
      ...apiKey,
      lastUsedAt: apiKey.lastUsedAt,
      expiresAt: apiKey.expiresAt,
    } satisfies ApiKey;

    next();
  };
}
