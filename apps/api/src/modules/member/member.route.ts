import { Hono } from "hono";

import {
  digestSettings,
  tabBarSettings,
  timeZoneSettings,
  type CurrentMember,
  type DigestSettings,
  type FamilyMemberList,
  type TabBarSettings,
  type TimeZoneSettings,
} from "@family-hub/contract";

import { requireMember, type AuthEnv } from "@/common/auth";
import { jsonBody } from "@/common/errors";

import type { MemberService } from "./member.service.ts";

type MemberRouteEnv = {
  Variables: AuthEnv["Variables"] & { members: MemberService };
};

export const memberRoute = new Hono<MemberRouteEnv>()
  .get("/api/me", requireMember, async (context) => {
    const membership = context.var.membership;
    const { member, family, isFamilyOwner } = membership;

    return context.json<CurrentMember>({
      member: { id: member.id, name: member.name },
      family,
      isFamilyOwner,
      settings: await context.var.members.settings(membership),
    });
  })
  .put(
    "/api/me/tab-bar",
    requireMember,
    jsonBody(tabBarSettings, "The tab bar takes 2 different modules besides the Feed"),
    async (context) =>
      context.json<TabBarSettings>({
        modules: await context.var.members.saveTabBar(
          context.var.membership,
          context.req.valid("json").modules,
        ),
      }),
  )
  .put(
    "/api/me/time-zone",
    requireMember,
    jsonBody(timeZoneSettings, "An IANA time zone is required"),
    async (context) =>
      context.json<TimeZoneSettings>(
        await context.var.members.saveTimeZone(context.var.membership, context.req.valid("json")),
      ),
  )
  .put(
    "/api/me/digest",
    requireMember,
    jsonBody(digestSettings, "The digest takes an on / off switch and a time as HH:MM"),
    async (context) =>
      context.json<DigestSettings>(
        await context.var.members.saveDigest(context.var.membership, context.req.valid("json")),
      ),
  )
  .get("/api/family/members", requireMember, async (context) =>
    context.json<FamilyMemberList>(await context.var.members.familyMembers(context.var.membership)),
  );
