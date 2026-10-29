import { Hono } from "hono";

import {
  digestSettings,
  reminderChannelSettings,
  tabBarSettings,
  timeZoneSettings,
  type CurrentMember,
  type DigestSettings,
  type FamilyMemberList,
  type ReminderChannelSettings,
  type TabBarSettings,
  type TimeZoneSettings,
} from "@family-hub/contract";

import { jsonBody } from "@/common/errors.lib.ts";
import { requireMember, type AuthEnv } from "@/modules/auth";

import type { MemberService } from "./member.service.ts";

type MemberRouteEnv = {
  Variables: AuthEnv["Variables"] & { members: MemberService };
};

export const memberRoute = new Hono<MemberRouteEnv>()
  .get("/api/me", requireMember, async (context) =>
    context.json<CurrentMember>(await context.var.members.current(context.var.membership)),
  )
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
  .put(
    "/api/me/reminder-channel",
    requireMember,
    jsonBody(reminderChannelSettings, "Reminders go to telegram, push or both"),
    async (context) =>
      context.json<ReminderChannelSettings>({
        channel: await context.var.members.saveReminderChannel(
          context.var.membership,
          context.req.valid("json").channel,
        ),
      }),
  )
  .get("/api/family/members", requireMember, async (context) =>
    context.json<FamilyMemberList>(await context.var.members.familyMembers(context.var.membership)),
  );
