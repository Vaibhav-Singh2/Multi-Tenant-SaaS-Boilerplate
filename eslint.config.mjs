import saasConfig from "@saas/eslint-config";

export default [
  ...saasConfig,
  {
    ignores: [".turbo/**", "**/dist/**", "**/node_modules/**"],
  },
];
