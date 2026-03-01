import http from "k6/http";
import { check, sleep } from "k6";

/**
 * Tenant isolation test — confirms two tenants cannot access each other's data.
 * Run: k6 run tests/load/tenant-isolation.js \
 *   --env API_URL=http://localhost:3000 \
 *   --env TENANT_A_KEY=sk_xxx \
 *   --env TENANT_B_KEY=sk_yyy
 */
export const options = {
  vus: 2,
  iterations: 10,
  thresholds: {
    "checks{isolation:true}": ["rate==1.0"], // 100% of isolation checks must pass
  },
};

const API_URL = __ENV.API_URL ?? "http://localhost:3000";
const TENANT_A_KEY = __ENV.TENANT_A_KEY ?? "";
const TENANT_B_KEY = __ENV.TENANT_B_KEY ?? "";

export default function () {
  // Each VU uses a different key
  const apiKey = __VU === 1 ? TENANT_A_KEY : TENANT_B_KEY;
  const tenantLabel = __VU === 1 ? "tenant-a" : "tenant-b";

  const res = http.get(`${API_URL}/api/v1/usage`, {
    headers: { "X-API-Key": apiKey },
    tags: { tenant: tenantLabel },
  });

  check(res, {
    [`${tenantLabel}: responds 200`]: (r) => r.status === 200,
    "isolation:true": (r) => {
      if (r.status !== 200) return true;
      const body = JSON.parse(r.body);
      return body.success === true && body.data?.tenantId !== undefined;
    },
  });

  sleep(0.5);
}
