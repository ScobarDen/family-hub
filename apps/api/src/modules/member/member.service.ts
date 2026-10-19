import {
  defaultTabBar,
  type AppModule,
  type FamilyMemberList,
  type MemberSettings,
  type TimeZoneSettings,
} from "@family-hub/contract";

import type { Membership } from "@/common/auth";
import type { Clock } from "@/common/clock";

import type { MemberRepo, MemberSettingsRow } from "./member.repo.ts";

type MemberServiceDependencies = { members: MemberRepo; clock: Clock };

function settingsFrom(row: MemberSettingsRow | undefined): MemberSettings {
  return {
    tabBar: row?.tabBar ?? defaultTabBar,
    timeZone:
      row?.timeZone === null || row === undefined
        ? null
        : { timeZone: row.timeZone, isAuto: row.isTimeZoneAuto },
    canMessage: row?.canMessage ?? true,
  };
}

export function createMemberService({ members, clock }: MemberServiceDependencies) {
  return {
    settings: async ({ member }: Membership) => settingsFrom(await members.settingsOf(member.id)),

    async saveTabBar({ member }: Membership, tabBar: AppModule[]): Promise<AppModule[]> {
      await members.saveTabBar(member.id, tabBar, clock.now());

      return tabBar;
    },

    async saveTimeZone({ member }: Membership, change: TimeZoneSettings) {
      await members.saveTimeZone(member.id, change, clock.now());

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
