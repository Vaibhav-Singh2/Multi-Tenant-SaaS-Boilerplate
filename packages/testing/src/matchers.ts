import { expect } from "vitest";

/**
 * Custom Vitest matchers for the SaaS boilerplate domain.
 * Usage: import "@saas/testing/matchers" in your test setup file.
 */

interface CustomMatchers<R = unknown> {
  toBeValidApiKey(): R;
  toBeValidUuid(): R;
  toBeValidSlug(): R;
}

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-explicit-any
  interface Assertion<T = any> extends CustomMatchers<T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

expect.extend({
  toBeValidApiKey(received: unknown) {
    const pass =
      typeof received === "string" && /^sk_[a-f0-9]{64}$/.test(received);
    return {
      pass,
      message: () =>
        pass
          ? `Expected "${String(received)}" NOT to be a valid API key`
          : `Expected "${String(received)}" to be a valid API key (sk_<64 hex chars>)`,
    };
  },

  toBeValidUuid(received: unknown) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = typeof received === "string" && uuidRegex.test(received);
    return {
      pass,
      message: () =>
        pass
          ? `Expected "${String(received)}" NOT to be a valid UUID`
          : `Expected "${String(received)}" to be a valid UUID v4`,
    };
  },

  toBeValidSlug(received: unknown) {
    const pass =
      typeof received === "string" &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(received);
    return {
      pass,
      message: () =>
        pass
          ? `Expected "${String(received)}" NOT to be a valid slug`
          : `Expected "${String(received)}" to be a valid slug (lowercase alphanumeric + hyphens)`,
    };
  },
});
