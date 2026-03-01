import crypto from "node:crypto";

const KEY_PREFIX_LENGTH = 8;
const KEY_BYTES = 32;

/**
 * Generates a cryptographically secure API key.
 * Format: `sk_<prefix><random>` where total length is predictable.
 */
export function generateApiKey(): string {
  const random = crypto.randomBytes(KEY_BYTES).toString("hex"); // 64 chars
  return `sk_${random}`;
}

/**
 * Returns the first KEY_PREFIX_LENGTH characters of the raw key (after `sk_`).
 * This prefix is stored in plaintext so users can identify keys.
 */
export function getKeyPrefix(apiKey: string): string {
  return apiKey.replace(/^sk_/, "").slice(0, KEY_PREFIX_LENGTH);
}

/**
 * Hashes the full API key using SHA-256.
 * Only the hash is stored in the database.
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

/**
 * Verifies a plain-text API key against a stored hash.
 */
export function verifyApiKey(plainKey: string, storedHash: string): boolean {
  const hash = hashApiKey(plainKey);
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(hash, "hex"),
    Buffer.from(storedHash, "hex"),
  );
}
