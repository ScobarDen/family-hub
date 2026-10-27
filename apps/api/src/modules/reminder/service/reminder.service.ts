import { bindFirst } from "@/common/bind";

import type { ChangedSource, ReminderDependencies } from "../reminder.types.ts";
import { handleReminderCallback } from "./callback.service.ts";
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
      handleCallback: handleReminderCallback,
      membershipChanged,
      digestChanged,
      zoneChanged,
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
