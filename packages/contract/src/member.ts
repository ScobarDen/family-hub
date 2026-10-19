import { z } from "zod";

export const appModule = z.enum(["feed", "plans", "calendar", "pet", "goals", "albums"]);

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
    return Intl.DateTimeFormat("en", { timeZone: name }).resolvedOptions().timeZone !== "";
  } catch {
    return false;
  }
}

export const timeZoneSettings = z.object({
  timeZone: z.string().refine(isTimeZone, "Not an IANA time zone"),
  isAuto: z.boolean(),
});

export type TimeZoneSettings = z.infer<typeof timeZoneSettings>;

export const memberSettings = z.object({
  tabBar,
  timeZone: timeZoneSettings.nullable(),
  canMessage: z.boolean(),
});

export type MemberSettings = z.infer<typeof memberSettings>;

export const familyMember = z.object({
  id: z.string(),
  name: z.string(),
  isFamilyOwner: z.boolean(),
});

export type FamilyMember = z.infer<typeof familyMember>;

export const familyMemberList = z.array(familyMember);

export type FamilyMemberList = z.infer<typeof familyMemberList>;
