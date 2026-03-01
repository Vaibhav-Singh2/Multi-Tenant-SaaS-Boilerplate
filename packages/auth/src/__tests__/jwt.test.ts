import { describe, it, expect } from "vitest";
import { signJwt, verifyJwt, decodeJwt } from "../jwt.js";

const SECRET = "test-secret-at-least-32-chars-long!";

describe("JWT utilities", () => {
  it("should sign and verify a JWT", () => {
    const token = signJwt({ sub: "admin-1", role: "admin" }, SECRET);
    const payload = verifyJwt(token, SECRET);
    expect(payload.sub).toBe("admin-1");
    expect(payload.role).toBe("admin");
  });

  it("should throw on invalid secret", () => {
    const token = signJwt({ sub: "admin-1", role: "admin" }, SECRET);
    expect(() => verifyJwt(token, "wrong-secret")).toThrow();
  });

  it("should throw on expired token", async () => {
    const token = signJwt({ sub: "admin-1", role: "admin" }, SECRET, "1ms");
    await new Promise((r) => setTimeout(r, 10));
    expect(() => verifyJwt(token, SECRET)).toThrow();
  });

  it("should decode without verification", () => {
    const token = signJwt({ sub: "tenant-1", role: "tenant" }, SECRET);
    const decoded = decodeJwt(token);
    expect(decoded?.sub).toBe("tenant-1");
  });

  it("should return null for invalid token on decodeJwt", () => {
    expect(decodeJwt("not.a.token")).toBeNull();
  });
});
