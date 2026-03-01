import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { eq } from "drizzle-orm";
import {
  getPublicDb,
  tenants,
  apiKeys,
  provisionTenantSchema,
  deprovisionTenantSchema,
} from "@saas/database";
import { generateApiKey, getKeyPrefix, hashApiKey } from "@saas/auth";
import { AppError } from "../middleware/errorHandler.js";
import type { AppQueues } from "@saas/queue";

export function tenantsRouter(_queues: AppQueues): Router {
  const router = Router();
  const db = getPublicDb();

  const getParamId = (req: Request): string => {
    const id = req.params["id"];
    if (Array.isArray(id)) return id[0] ?? "";
    return id ?? "";
  };

  // POST /admin/tenants — Create tenant
  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        name,
        slug,
        plan = "free",
        rateLimitPerMinute = 100,
      } = req.body as {
        name: string;
        slug: string;
        plan?: string;
        rateLimitPerMinute?: number;
      };

      if (!name || !slug) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "name and slug are required",
        );
      }
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        throw new AppError(
          400,
          "INVALID_SLUG",
          "Slug must be lowercase alphanumeric with hyphens only",
        );
      }

      const schemaName = `tenant_${slug}`;

      // Create tenant record
      const [tenant] = await db
        .insert(tenants)
        .values({ name, slug, schemaName, plan, rateLimitPerMinute })
        .returning();

      if (!tenant)
        throw new AppError(500, "DB_ERROR", "Failed to create tenant");

      // Provision isolated PostgreSQL schema
      await provisionTenantSchema(slug);

      // Generate initial API key
      const plainKey = generateApiKey();
      const keyHash = hashApiKey(plainKey);
      const keyPrefix = getKeyPrefix(plainKey);

      const [apiKey] = await db
        .insert(apiKeys)
        .values({ tenantId: tenant.id, name: "Default", keyHash, keyPrefix })
        .returning();

      res.status(201).json({
        success: true,
        data: {
          tenant,
          apiKey: {
            ...apiKey,
            plainKey, // returned once only
          },
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /admin/tenants — List all tenants
  router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const all = await db.select().from(tenants).orderBy(tenants.createdAt);
      res.json({ success: true, data: all });
    } catch (err) {
      next(err);
    }
  });

  // GET /admin/tenants/:id — Get single tenant
  router.get(
    "/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = getParamId(req);
        const [tenant] = await db
          .select()
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .limit(1);
        if (!tenant) throw new AppError(404, "NOT_FOUND", "Tenant not found");
        const keys = await db
          .select()
          .from(apiKeys)
          .where(eq(apiKeys.tenantId, tenant.id));
        res.json({ success: true, data: { tenant, apiKeys: keys } });
      } catch (err) {
        next(err);
      }
    },
  );

  // DELETE /admin/tenants/:id — Delete tenant
  router.delete(
    "/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = getParamId(req);
        const [tenant] = await db
          .select()
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .limit(1);
        if (!tenant) throw new AppError(404, "NOT_FOUND", "Tenant not found");

        await deprovisionTenantSchema(tenant.slug);
        await db.delete(tenants).where(eq(tenants.id, tenant.id));

        res.json({ success: true, data: { message: "Tenant deleted" } });
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /admin/tenants/:id/rotate-key — Rotate API key
  router.post(
    "/:id/rotate-key",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = getParamId(req);
        const [tenant] = await db
          .select()
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .limit(1);
        if (!tenant) throw new AppError(404, "NOT_FOUND", "Tenant not found");

        // Deactivate old keys
        await db
          .update(apiKeys)
          .set({ isActive: false })
          .where(eq(apiKeys.tenantId, tenantId));

        // Create new key
        const plainKey = generateApiKey();
        const keyHash = hashApiKey(plainKey);
        const keyPrefix = getKeyPrefix(plainKey);
        const name = (req.body as { name?: string }).name ?? "Rotated Key";

        const [newKey] = await db
          .insert(apiKeys)
          .values({ tenantId, name, keyHash, keyPrefix })
          .returning();

        res.json({
          success: true,
          data: { apiKey: { ...newKey, plainKey } },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
