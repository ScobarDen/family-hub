import { z } from "zod";

import { named, time } from "./primitive.ts";

export const appModule = z.enum(["feed", "plans", "calendar", "pet", "goals", "albums", "recipes"]);

export type AppModule = z.infer<typeof appModule>;

export const tabBarMinModules = 2;
export const tabBarMaxModules = 5;

export const defaultTabBar: AppModule[] = ["feed", "plans", "calendar", "pet"];

export const tabBar = z
  .array(appModule)
  .min(tabBarMinModules)
  .max(tabBarMaxModules)
  .refine((modules) => new Set(modules).size === modules.length, "Modules repeat");

export const tabBarSettings = z.object({ modules: tabBar });

export type TabBarSettings = z.infer<typeof tabBarSettings>;

export function isTimeZone(name: string): boolean {
  try {
    Intl.DateTimeFormat("en", { timeZone: name });

    return true;
  } catch {
    return false;
  }
}

export const timeZoneSettings = z.object({
  timeZone: z.string().refine(isTimeZone, "Not an IANA time zone"),
  isAuto: z.boolean(),
});

export type TimeZoneSettings = z.infer<typeof timeZoneSettings>;

export const defaultDigestTime = "09:00";

// The morning digest: on by default, at 09:00 on the Member's own clock.
export const digestSettings = z.object({
  isEnabled: z.boolean(),
  time,
});

export type DigestSettings = z.infer<typeof digestSettings>;

export const memberSettings = z.object({
  tabBar,
  timeZone: timeZoneSettings.nullable(),
  canMessage: z.boolean(),
  digest: digestSettings,
});

export type MemberSettings = z.infer<typeof memberSettings>;

export const familyMember = named.extend({ isFamilyOwner: z.boolean() });

export type FamilyMember = z.infer<typeof familyMember>;

export const familyMemberList = z.array(familyMember);

export type FamilyMemberList = z.infer<typeof familyMemberList>;
