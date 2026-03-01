import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as publicSchema from "./schema/public.js";
import * as tenantSchema from "./schema/tenant.js";

// ─── Public DB client (default search_path = public) ─────────────────────────

let _publicSql: ReturnType<typeof postgres> | null = null;

export function getPublicSql() {
  if (!_publicSql) {
    const url = process.env["DATABASE_URL"];
    if (!url) throw new Error("DATABASE_URL is not set");
    _publicSql = postgres(url, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return _publicSql;
}

export function getPublicDb() {
  return drizzle(getPublicSql(), { schema: publicSchema });
}

// ─── Tenant-scoped DB client ──────────────────────────────────────────────────
// Creates a Drizzle instance scoped to the tenant's schema by setting
// search_path on every connection from a dedicated pool.

const tenantClients = new Map<string, ReturnType<typeof drizzle>>();

export function getTenantDb(slug: string) {
  if (tenantClients.has(slug)) {
    return tenantClients.get(slug)!;
  }

  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL is not set");

  const schemaName = `tenant_${slug}`;
  const sql = postgres(url, {
    max: 5,
    idle_timeout: 30,
    connect_timeout: 10,
    // Set search_path per connection so all queries go to tenant schema first
    onnotice: () => {},
    connection: { search_path: `${schemaName},public` },
  });

  const db = drizzle(sql, { schema: tenantSchema });
  tenantClients.set(slug, db);
  return db;
}

// ─── Schema provisioning ──────────────────────────────────────────────────────

/**
 * Creates the tenant's PostgreSQL schema and base tables.
 * Called once during tenant creation.
 */
export async function provisionTenantSchema(slug: string): Promise<void> {
  const schemaName = `tenant_${slug}`;
  const sql = getPublicSql();

  // Create schema
  await sql`CREATE SCHEMA IF NOT EXISTS ${sql(schemaName)}`;

  // Create tenant tables inside tenant schema
  await sql`
    CREATE TABLE IF NOT EXISTS ${sql(schemaName)}.resources (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      data JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ${sql(schemaName)}.audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      actor TEXT,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

/**
 * Drops the tenant's PostgreSQL schema and all its tables.
 * Called during tenant deletion.
 */
export async function deprovisionTenantSchema(slug: string): Promise<void> {
  const schemaName = `tenant_${slug}`;
  const sql = getPublicSql();
  await sql`DROP SCHEMA IF EXISTS ${sql(schemaName)} CASCADE`;
}

export * from "./schema/public.js";
export * from "./schema/tenant.js";
