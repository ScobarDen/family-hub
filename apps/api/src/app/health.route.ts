import { sql } from "drizzle-orm";
import { Hono } from "hono";
import type { AppEnv } from "./app.types.ts";

export const healthRoute = new Hono<AppEnv>().get("/api/health", async (c) => {
  await c.var.db.run(sql`select 1`);
  return c.json({ status: "ok" });
});
