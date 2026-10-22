import { uuidv7 } from "@family-hub/contract";
import { dateInZone, dayBefore } from "@family-hub/recurrence";

import { changesOf, fallbackTimeZone, rowKey, type PlannedRow } from "../reminder.lib.ts";
import type { SourceHolder, HolderKind, ReminderDependencies, Source } from "../reminder.types.ts";
import { familySources, kindsOf, sourceOfRow, sourcesOf } from "./source.service.ts";

export type Fire = { occurrence: string; fireAt: number };

type Planning = {
  sources: Source[];
  now: number;
  isMissing?: (key: Omit<PlannedRow, "fire">) => boolean;
};

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

async function plannedOf(
  dependencies: ReminderDependencies,
  { sources, now, isMissing = () => true }: Planning,
): Promise<PlannedRow[]> {
  const planned: PlannedRow[] = [];

  for (const source of sources) {
    for (const memberId of source.recipientIds) {
      const key = { source: source.kind, sourceId: source.sourceId, memberId };

      if (isMissing(key)) {
        const timeZone = await zoneOf(dependencies, { memberId, source });

        planned.push({ ...key, fire: upcoming(source, { timeZone, now }) });
      }
    }
  }

  return planned;
}

export async function sourceChanged(
  dependencies: ReminderDependencies,
  holder: SourceHolder & { kind: HolderKind },
): Promise<void> {
  const now = dependencies.clock.now();
  const planned = await plannedOf(dependencies, {
    sources: await sourcesOf(dependencies, holder),
    now,
  });
  const existing = await dependencies.dispatch.ofHolder({
    familyId: holder.familyId,
    sources: kindsOf(holder.kind),
    holderId: holder.id,
  });

  await dependencies.dispatch.write(
    { familyId: holder.familyId, now, ...changesOf({ existing, planned, now }) },
    () => uuidv7(now),
  );
}

export async function digestChanged(dependencies: ReminderDependencies, memberId: string) {
  const membership = await dependencies.memberships.findByMemberId(memberId);

  if (membership !== undefined) {
    await sourceChanged(dependencies, {
      kind: "member",
      familyId: membership.family.id,
      id: memberId,
    });
  }
}

// A new zone moves every Reminder of the Member to its time on their new clock.
export async function zoneChanged(dependencies: ReminderDependencies, memberId: string) {
  const now = dependencies.clock.now();
  const membership = await dependencies.memberships.findByMemberId(memberId);

  if (membership === undefined) {
    return;
  }

  // The first zone a Member reports is also when their digest gets its row.
  await digestChanged(dependencies, memberId);

  const familyId = membership.family.id;

  for (const row of await dependencies.dispatch.ofMember({ familyId, memberId })) {
    const source = await sourceOfRow(dependencies, row);
    const timeZone = await zoneOf(dependencies, { memberId, source });
    const fire = source === undefined ? undefined : upcoming(source, { timeZone, now });

    await dependencies.dispatch.update(familyId, row.id, {
      occurrence: fire?.occurrence ?? null,
      nextFireAt: fire?.fireAt ?? null,
      updatedAt: now,
    });
  }
}

// Rows already there stay as they are, snoozes included: a Member who joined gets rows for every
// source that now reaches them, and one who left loses theirs along with their chosen-Recipient places.
export async function membershipChanged(dependencies: ReminderDependencies, familyId: string) {
  const now = dependencies.clock.now();

  await dependencies.reminders.removeDepartedRecipients(familyId);
  await dependencies.dispatch.removeDeparted(familyId);

  const rows = await dependencies.dispatch.ofFamily(familyId);
  const kept = new Set(rows.map(rowKey));
  const planned = await plannedOf(dependencies, {
    sources: await familySources(dependencies, familyId),
    now,
    isMissing: (key) => !kept.has(rowKey(key)),
  });

  await dependencies.dispatch.write(
    { familyId, now, ...changesOf({ existing: [], planned, now }) },
    () => uuidv7(now),
  );
}
