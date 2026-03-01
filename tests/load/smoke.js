import http from "k6/http";
import { check, sleep } from "k6";

/**
 * Smoke test — verifies the API is up and returns expected responses.
 * Run: k6 run tests/load/smoke.js --env API_URL=http://localhost:3000
 */
export const options = {
  vus: 1,
  iterations: 10,
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};

const API_URL = __ENV.API_URL ?? "http://localhost:3000";

export default function () {
  // Health check
  const healthRes = http.get(`${API_URL}/health`);
  check(healthRes, {
    "health status 200": (r) => r.status === 200,
    "health body has status": (r) => {
      const body = JSON.parse(r.body);
      return body.status === "healthy";
    },
  });

  sleep(0.5);
}
