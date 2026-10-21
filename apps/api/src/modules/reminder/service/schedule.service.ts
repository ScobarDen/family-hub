import { uuidv7 } from "@family-hub/contract";

import { upcomingFire } from "../reminder.lib.ts";
import type { ReminderDependencies } from "../reminder.types.ts";
import type { ReminderWithRecipients } from "../repo/reminder.repo.ts";

// Called whenever a Reminder or its Recipients change: each Recipient waits for the next
// Occurrence still ahead.
export async function reschedule(
  { dispatch, clock }: ReminderDependencies,
  { reminder, recipients }: ReminderWithRecipients,
): Promise<void> {
  const now = clock.now();
  const fire = upcomingFire(reminder, now);
  const plans =
    fire === undefined
      ? []
      : recipients.map(({ id }) => ({
          memberId: id,
          occurrence: fire.occurrence,
          nextFireAt: fire.fireAt,
        }));

  await dispatch.replace({ familyId: reminder.familyId, sourceId: reminder.id, plans, now }, () =>
    uuidv7(now),
  );
}
