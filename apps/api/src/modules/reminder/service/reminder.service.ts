import { bindFirst } from "@/common/bind.lib.ts";

import type { ChangedSource, ReminderDependencies } from "../reminder.types.ts";
import { handlePushPress, handleReminderCallback } from "./callback.service.ts";
import { deliverDue } from "./delivery.service.ts";
import { sendToday } from "./digest-source.service.ts";
import {
  digestChanged,
  membershipChanged,
  sourceChanged,
  zoneChanged,
} from "./schedule.service.ts";

export function createReminderService(dependencies: ReminderDependencies) {
  return {
    ...bindFirst(dependencies, {
      handleCallback: handleReminderCallback,
      handlePushPress,
      membershipChanged,
      digestChanged,
      zoneChanged,
      sendToday,
    }),
    deliverDue: async () => deliverDue(dependencies),
    // A Pet's archive also silences or wakes the Reminders of its Tasks.
    async sourceChanged(familyId: string, source: ChangedSource) {
      await sourceChanged(dependencies, { familyId, ...source });

      if (source.kind === "pet") {
        for (const id of await dependencies.sources.tasksOfPet({ familyId, id: source.id })) {
          await sourceChanged(dependencies, { familyId, kind: "task", id });
        }
      }
    },
  };
}

export type ReminderService = ReturnType<typeof createReminderService>;
