import http from "k6/http";
import { check, sleep } from "k6";

/**
 * Rate limit test — confirms the 429 response fires after exceeding tenant limit.
 * Run: k6 run tests/load/ratelimit.js --env API_URL=http://localhost:3000 --env API_KEY=sk_xxx
 */
export const options = {
  vus: 1,
  iterations: 20,
  thresholds: {
    // At least 1 request should be rate-limited
    "checks{type:rate_limited}": ["rate>0"],
  },
};

const API_URL = __ENV.API_URL ?? "http://localhost:3000";
const API_KEY = __ENV.API_KEY ?? "sk_test_key";

export default function () {
  const res = http.get(`${API_URL}/api/v1/usage`, {
    headers: { "X-API-Key": API_KEY },
  });

  const isRateLimited = res.status === 429;

  check(res, {
    "response is 200 or 429": (r) => r.status === 200 || r.status === 429,
  });

  check(res, { "type:rate_limited": () => isRateLimited });

  if (!isRateLimited) {
    check(res, {
      "has X-RateLimit-Limit header": (r) =>
        r.headers["X-Ratelimit-Limit"] !== undefined,
      "has X-RateLimit-Remaining header": (r) =>
        r.headers["X-Ratelimit-Remaining"] !== undefined,
    });
  }

  sleep(0.05); // 20 rps — exceeds typical 10/min limit quickly
}
