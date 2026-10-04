import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/common/db/schema.ts",
  out: "./migrations",
});
