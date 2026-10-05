import { sql } from "drizzle-orm";
import { Hono } from "hono";

import type { AppEnv } from "./app.types.ts";

export const healthRoute = new Hono<AppEnv>().get("/api/health", async (context) => {
  await context.var.db.run(sql`select 1`);

  return context.json({ status: "ok" });
});
