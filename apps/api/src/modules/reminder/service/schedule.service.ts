import { uuidv7 } from "@family-hub/contract";
import { dateInZone, dayBefore } from "@family-hub/recurrence";

import type { DispatchSource } from "@/common/db";

import { fallbackTimeZone } from "../reminder.lib.ts";
import type { ReminderDependencies, Source } from "../reminder.types.ts";
import type { DispatchPlan } from "../repo/dispatch.repo.ts";
import type { ReminderWithRecipients } from "../repo/reminder.repo.ts";
import { reminderSource } from "./calendar-source.service.ts";
import { planSources } from "./plan-source.service.ts";
import { birthdayOf, dueSources, eventSources, sourceOfRow } from "./source.service.ts";

export type Fire = { occurrence: string; fireAt: number };

export async function zoneOf(
  { sources }: ReminderDependencies,
  { memberId, source }: { memberId: string; source: Source | undefined },
): Promise<string> {
  return (await sources.timeZoneOf(memberId)) ?? source?.homeZone ?? fallbackTimeZone;
}

// The first Occurrence that still fires ahead of now on this Recipient's clock; the search starts
// a day early, as a moment set in another zone may fall on the Recipient's previous day.
export function upcoming(
  source: Source,
  { timeZone, now }: { timeZone: string; now: number },
): Fire | undefined {
  let occurrence = source.first(dayBefore(dateInZone(now, timeZone)));

  while (occurrence !== undefined && source.fireAt(occurrence, timeZone) < now) {
    occurrence = source.next(occurrence);
  }

  return occurrence === undefined
    ? undefined
    : { occurrence, fireAt: source.fireAt(occurrence, timeZone) };
}

export function fireAfter(
  source: Source,
  { occurrence, timeZone }: { occurrence: string; timeZone: string },
): Fire | undefined {
  const next = source.next(occurrence);

  return next === undefined
    ? undefined
    : { occurrence: next, fireAt: source.fireAt(next, timeZone) };
}

async function plansOf(dependencies: ReminderDependencies, source: Source, now: number) {
  const plans: DispatchPlan[] = [];

  for (const memberId of source.recipientIds) {
    const fire = upcoming(source, {
      timeZone: await zoneOf(dependencies, { memberId, source }),
      now,
    });

    if (fire !== undefined) {
      plans.push({
        sourceId: source.sourceId,
        memberId,
        occurrence: fire.occurrence,
        nextFireAt: fire.fireAt,
      });
    }
  }

  return plans;
}

type Rows = { familyId: string; kind: DispatchSource; prefix: string; sources: Source[] };

// Called whenever a source changes: its rows are rewritten for the Recipients it has now.
async function scheduleRows(
  dependencies: ReminderDependencies,
  { familyId, kind, prefix, sources }: Rows,
): Promise<void> {
  const now = dependencies.clock.now();
  const plans = await Promise.all(
    sources.map(async (source) => plansOf(dependencies, source, now)),
  );

  await dependencies.dispatch.replace(
    { familyId, source: kind, prefix, plans: plans.flat(), now },
    () => uuidv7(now),
  );
}

export async function reschedule(
  dependencies: ReminderDependencies,
  { reminder, recipients }: ReminderWithRecipients,
): Promise<void> {
  await scheduleRows(dependencies, {
    familyId: reminder.familyId,
    kind: "reminder",
    prefix: reminder.id,
    sources: [
      reminderSource(
        reminder,
        recipients.map(({ id }) => id),
      ),
    ],
  });
}

export async function eventChanged(
  dependencies: ReminderDependencies,
  { familyId, eventId }: { familyId: string; eventId: string },
): Promise<void> {
  await scheduleRows(dependencies, {
    familyId,
    kind: "event",
    prefix: `${eventId}:`,
    sources: await eventSources(dependencies, eventId),
  });
}

export async function petChanged(
  dependencies: ReminderDependencies,
  { familyId, petId }: { familyId: string; petId: string },
): Promise<void> {
  const birthday = await birthdayOf(dependencies, petId);

  await scheduleRows(dependencies, {
    familyId,
    kind: "pet_birthday",
    prefix: petId,
    sources: birthday === undefined ? [] : [birthday],
  });
  await scheduleRows(dependencies, {
    familyId,
    kind: "pet_due",
    prefix: `${petId}:`,
    sources: await dueSources(dependencies, petId),
  });
}

export async function planChanged(
  dependencies: ReminderDependencies,
  { familyId, planId }: { familyId: string; planId: string },
): Promise<void> {
  await scheduleRows(dependencies, {
    familyId,
    kind: "plan",
    prefix: `${planId}:`,
    sources: await planSources(dependencies, planId),
  });
}

// A new zone moves every Reminder of the Member to its time on their new clock.
export async function zoneChanged(dependencies: ReminderDependencies, memberId: string) {
  const now = dependencies.clock.now();

  for (const row of await dependencies.dispatch.ofMember(memberId)) {
    const source = await sourceOfRow(dependencies, row);
    const timeZone = await zoneOf(dependencies, { memberId, source });
    const fire = source === undefined ? undefined : upcoming(source, { timeZone, now });

    await dependencies.dispatch.update(row.id, {
      occurrence: fire?.occurrence ?? null,
      nextFireAt: fire?.fireAt ?? null,
      updatedAt: now,
    });
  }
}
