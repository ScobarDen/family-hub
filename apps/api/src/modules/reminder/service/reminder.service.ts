import type { ReminderChange } from "@family-hub/contract";

import type { Membership } from "@/common/auth";
import { bindFirst } from "@/common/bind";

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
    ...bindFirst(dependencies, {
      list,
      create,
      remove,
      handleCallback: handleReminderCallback,
      membershipChanged,
      digestChanged,
      zoneChanged,
    }),
    update: async (membership: Membership, reminderId: string, change: ReminderChange) =>
      update(dependencies, membership, { reminderId, change }),
    deliverDue: async () => deliverDue(dependencies),
    sourceChanged: async (familyId: string, source: ChangedSource) =>
      sourceChanged(dependencies, { familyId, ...source }),
  };
}

export type ReminderService = ReturnType<typeof createReminderService>;
