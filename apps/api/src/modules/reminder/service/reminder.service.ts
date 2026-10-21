import type { CallbackQuery } from "@grammyjs/types";

import type { ReminderChange } from "@family-hub/contract";

import type { Membership } from "@/common/auth";

import type { ReminderDependencies } from "../reminder.types.ts";
import { handleReminderCallback } from "./callback.service.ts";
import { create, list, remove, update } from "./crud.service.ts";
import { deliverDue } from "./delivery.service.ts";
import { eventChanged, petChanged, planChanged, zoneChanged } from "./schedule.service.ts";

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
    eventChanged: async (familyId: string, eventId: string) =>
      eventChanged(dependencies, { familyId, eventId }),
    petChanged: async (familyId: string, petId: string) =>
      petChanged(dependencies, { familyId, petId }),
    planChanged: async (familyId: string, planId: string) =>
      planChanged(dependencies, { familyId, planId }),
    zoneChanged: async (memberId: string) => zoneChanged(dependencies, memberId),
  };
}

export type ReminderService = ReturnType<typeof createReminderService>;
