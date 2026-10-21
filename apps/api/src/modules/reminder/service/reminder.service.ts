import type { CallbackQuery } from "@grammyjs/types";

import type { ReminderChange } from "@family-hub/contract";

import type { Membership } from "@/common/auth";

import type { ChangedSource, ReminderDependencies } from "../reminder.types.ts";
import { handleReminderCallback } from "./callback.service.ts";
import { create, list, remove, update } from "./crud.service.ts";
import { deliverDue } from "./delivery.service.ts";
import {
  digestChanged,
  membershipChanged,
  sourceChanged,
  zoneChanged,
} from "./schedule.service.ts";

export function createReminderService(dependencies: ReminderDependencies) {
  return {
    list: async (membership: Membership) => list(dependencies, membership),
    create: async (membership: Membership, change: ReminderChange) =>
      create(dependencies, membership, change),
    update: async (membership: Membership, reminderId: string, change: ReminderChange) =>
      update(dependencies, membership, { reminderId, change }),
    remove: async (membership: Membership, reminderId: string) =>
      remove(dependencies, membership, reminderId),
    deliverDue: async () => deliverDue(dependencies),
    handleCallback: async (query: CallbackQuery) => handleReminderCallback(dependencies, query),
    sourceChanged: async (familyId: string, source: ChangedSource) =>
      sourceChanged(dependencies, { familyId, ...source }),
    membershipChanged: async (familyId: string) => membershipChanged(dependencies, familyId),
    digestChanged: async (memberId: string) => digestChanged(dependencies, memberId),
    zoneChanged: async (memberId: string) => zoneChanged(dependencies, memberId),
  };
}

export type ReminderService = ReturnType<typeof createReminderService>;
