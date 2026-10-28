import {
  defaultDigestTime,
  defaultTabBar,
  slotModule,
  tabBarSlots,
  type CurrentMember,
  type DigestSettings,
  type FamilyMemberList,
  type MemberSettings,
  type SlotModule,
  type TimeZoneSettings,
} from "@family-hub/contract";

import type { Membership } from "@/common/auth";
import type { Clock } from "@/common/clock";

import type { MemberRepo, MemberSettingsRow } from "./member.repo.ts";

// Reminders of floating dates come at 09:00 on the Member's clock, so a new zone retimes them.
type MemberSchedule = {
  zoneChanged(memberId: string): Promise<void>;
  digestChanged(memberId: string): Promise<void>;
};

type MemberServiceDependencies = { members: MemberRepo; clock: Clock; schedule: MemberSchedule };

function digestFrom(row: MemberSettingsRow | undefined): DigestSettings {
  return row === undefined
    ? { isEnabled: true, time: defaultDigestTime }
    : { isEnabled: row.isDigestEnabled, time: row.digestTime };
}

// Plans and Calendar became «Дела», so a slot of either reads as tasks.
const renamedModules = new Map([
  ["plans", "tasks"],
  ["calendar", "tasks"],
]);

// The raw column keeps what was saved: a tab bar from before the two slots keeps its first two
// modules besides the Feed, and one with both Plans and Calendar gets Pets in its second slot.
function slotsOf(stored: string[] | null | undefined): SlotModule[] {
  const kept = (stored ?? []).flatMap((module) => {
    const slot = slotModule.safeParse(renamedModules.get(module) ?? module);

    return slot.success ? [slot.data] : [];
  });

  return [...new Set([...kept, ...defaultTabBar])].slice(0, tabBarSlots);
}

function settingsFrom(row: MemberSettingsRow | undefined): MemberSettings {
  return {
    tabBar: slotsOf(row?.tabBar),
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
    current: async ({ member, family, isFamilyOwner }: Membership): Promise<CurrentMember> => ({
      member: { id: member.id, name: member.name },
      family,
      isFamilyOwner,
      settings: settingsFrom(await members.settingsOf(member.id)),
    }),

    allowMessages: async (telegramId: number) => members.allowMessages(telegramId, clock.now()),

    async saveTabBar({ member }: Membership, tabBar: SlotModule[]): Promise<SlotModule[]> {
      await members.saveTabBar(member.id, tabBar, clock.now());

      return tabBar;
    },

    async saveTimeZone({ member }: Membership, change: TimeZoneSettings) {
      await members.saveTimeZone(member.id, change, clock.now());

      if (member.timeZone !== change.timeZone) {
        await schedule.zoneChanged(member.id);
      }

      return change;
    },

    async saveDigest({ member }: Membership, change: DigestSettings) {
      await members.saveDigest(member.id, change, clock.now());
      await schedule.digestChanged(member.id);

      return change;
    },

    async familyMembers({ family }: Membership): Promise<FamilyMemberList> {
      const rows = await members.listFamily(family.id);

      return rows.map(({ id, name, profilePicture, ownerMemberId }) => ({
        id,
        name,
        isFamilyOwner: id === ownerMemberId,
        profilePicture,
      }));
    },
  };
}

export type MemberService = ReturnType<typeof createMemberService>;
