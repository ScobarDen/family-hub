import { Hono } from "hono";

import type { FeedPage } from "@family-hub/contract";

import { requireMember, type MemberEnv } from "@/common/auth";

import type { FeedService } from "./service/feed.service.ts";

type FeedEnv = {
  Variables: MemberEnv["Variables"] & { feed: FeedService };
};

export const feedRoute = new Hono<FeedEnv>()
  .use("/api/feed", requireMember)
  .get("/api/feed", async (context) =>
    context.json<FeedPage>(
      await context.var.feed.page(context.var.membership, context.req.query("before")),
    ),
  );
