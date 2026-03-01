import { faker } from "@faker-js/faker";

// ─── Tenant factory ───────────────────────────────────────────────────────────

export function createTenantFactory(overrides: Record<string, unknown> = {}) {
  const name = faker.company.name();
  const slug = faker.helpers
    .slugify(name)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 30);

  return {
    id: faker.string.uuid(),
    name,
    slug,
    schemaName: `tenant_${slug}`,
    isActive: true,
    plan: "free" as const,
    rateLimitPerMinute: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── API Key factory ──────────────────────────────────────────────────────────

export function createApiKeyFactory(
  tenantId: string,
  overrides: Record<string, unknown> = {},
) {
  const prefix = faker.string.alphanumeric(8).toLowerCase();
  return {
    id: faker.string.uuid(),
    tenantId,
    name: "Test Key",
    keyPrefix: prefix,
    keyHash: faker.string.hexadecimal({ length: 64 }).toLowerCase(),
    isActive: true,
    lastUsedAt: null,
    expiresAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── Usage Record factory ─────────────────────────────────────────────────────

export function createUsageRecordFactory(
  tenantId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: faker.string.uuid(),
    tenantId,
    endpoint: faker.helpers.arrayElement([
      "/api/v1/usage",
      "/api/v1/resources",
      "/webhooks/inbound",
    ]),
    method: faker.helpers.arrayElement(["GET", "POST", "PUT", "DELETE"]),
    statusCode: faker.helpers.arrayElement([200, 201, 400, 401, 404, 500]),
    responseTimeMs: faker.number.int({ min: 5, max: 2000 }),
    timestamp: faker.date.recent(),
    ...overrides,
  };
}
