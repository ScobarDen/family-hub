import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/modules/db/schema.ts",
  out: "./migrations",
});
