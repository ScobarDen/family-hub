import { Hono } from "hono";

import type { Today } from "@family-hub/contract";

import { requireMember, type MemberEnv } from "@/modules/auth";

import type { TodayService } from "./today.service.ts";

type TodayEnv = {
  Variables: MemberEnv["Variables"] & { today: TodayService };
};

export const todayRoute = new Hono<TodayEnv>()
  .use("/api/today", requireMember)
  .get("/api/today", async (context) =>
    context.json<Today>(await context.var.today.of(context.var.membership)),
  );
