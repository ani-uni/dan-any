import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./src/core/db/migrations",
  schema: "./src/core/db/schema.ts",
  dialect: "postgresql",
  driver: "pglite",
});
