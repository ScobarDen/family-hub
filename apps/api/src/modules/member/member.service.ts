import {
  defaultDigestTime,
  defaultTabBar,
  type DigestSettings,
  type AppModule,
  type FamilyMemberList,
  type MemberSettings,
  type TimeZoneSettings,
} from "@family-hub/contract";

import type { Membership } from "@/common/auth";
import type { Clock } from "@/common/clock";

import type { MemberRepo, MemberSettingsRow } from "./member.repo.ts";

// Reminders of floating dates come at 09:00 on the Member's clock, so a new zone retimes them.
export type MemberSchedule = {
  zoneChanged(memberId: string): Promise<void>;
  digestChanged(memberId: string): Promise<void>;
};

type MemberServiceDependencies = { members: MemberRepo; clock: Clock; schedule: MemberSchedule };

function digestFrom(row: MemberSettingsRow | undefined): DigestSettings {
  return row === undefined
    ? { isEnabled: true, time: defaultDigestTime }
    : { isEnabled: row.isDigestEnabled, time: row.digestTime };
}

function settingsFrom(row: MemberSettingsRow | undefined): MemberSettings {
  return {
    tabBar: row?.tabBar ?? defaultTabBar,
    timeZone:
      row?.timeZone === null || row === undefined
        ? null
        : { timeZone: row.timeZone, isAuto: row.isTimeZoneAuto },
    canMessage: row?.canMessage ?? true,
    digest: digestFrom(row),
  };
}

export function createMemberService({ members, clock, schedule }: MemberServiceDependencies) {
  return {
    settings: async ({ member }: Membership) => settingsFrom(await members.settingsOf(member.id)),

    allowMessages: async (telegramId: number) => members.allowMessages(telegramId, clock.now()),

    async saveTabBar({ member }: Membership, tabBar: AppModule[]): Promise<AppModule[]> {
      await members.saveTabBar(member.id, tabBar, clock.now());

      return tabBar;
    },

    async saveTimeZone({ member }: Membership, change: TimeZoneSettings) {
      await members.saveTimeZone(member.id, change, clock.now());
      await schedule.zoneChanged(member.id);

      return change;
    },

    async saveDigest({ member }: Membership, change: DigestSettings) {
      await members.saveDigest(member.id, change, clock.now());
      await schedule.digestChanged(member.id);

      return change;
    },

    async familyMembers({ family }: Membership): Promise<FamilyMemberList> {
      const rows = await members.listFamily(family.id);

      return rows.map(({ id, name, ownerMemberId }) => ({
        id,
        name,
        isFamilyOwner: id === ownerMemberId,
      }));
    },
  };
}

export type MemberService = ReturnType<typeof createMemberService>;
