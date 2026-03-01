import { describe, it, expect } from "vitest";
import {
  generateApiKey,
  getKeyPrefix,
  hashApiKey,
  verifyApiKey,
} from "../apikey.js";

describe("generateApiKey", () => {
  it("should generate a key with sk_ prefix", () => {
    const key = generateApiKey();
    expect(key).toMatch(/^sk_[a-f0-9]{64}$/);
  });

  it("should generate unique keys", () => {
    const keys = new Set(Array.from({ length: 100 }, () => generateApiKey()));
    expect(keys.size).toBe(100);
  });
});

describe("getKeyPrefix", () => {
  it("should return first 8 chars after sk_ prefix", () => {
    const key =
      "sk_abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab";
    const prefix = getKeyPrefix(key);
    expect(prefix).toBe("abcdef12");
    expect(prefix).toHaveLength(8);
  });
});

describe("hashApiKey", () => {
  it("should return a hex SHA-256 hash", () => {
    const hash = hashApiKey("sk_abc");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("same key should produce same hash (deterministic)", () => {
    const key = generateApiKey();
    expect(hashApiKey(key)).toBe(hashApiKey(key));
  });

  it("different keys should produce different hashes", () => {
    const h1 = hashApiKey(generateApiKey());
    const h2 = hashApiKey(generateApiKey());
    expect(h1).not.toBe(h2);
  });
});

describe("verifyApiKey", () => {
  it("should return true for matching key and hash", () => {
    const key = generateApiKey();
    const hash = hashApiKey(key);
    expect(verifyApiKey(key, hash)).toBe(true);
  });

  it("should return false for wrong key", () => {
    const key = generateApiKey();
    const hash = hashApiKey(key);
    expect(verifyApiKey(generateApiKey(), hash)).toBe(false);
  });
});
