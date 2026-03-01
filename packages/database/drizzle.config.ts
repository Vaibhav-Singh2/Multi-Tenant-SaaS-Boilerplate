import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/public.ts",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? "postgres://localhost:5432/saas",
  },
  verbose: true,
  strict: true,
});
