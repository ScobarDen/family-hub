import { uuidv7 } from "@family-hub/contract";
import { dateInZone, daysAfter } from "@family-hub/recurrence";

import { fallbackTimeZone } from "@/common/clock.lib.ts";

import type {
  HolderKind,
  ReminderDependencies,
  ReminderSchedule,
  SourceHolder,
} from "../reminder.types.ts";
import type { DispatchRow } from "../repo/dispatch.repo.ts";
import { changesOf, rowKey, type PlannedRow } from "./dispatch-plan.service.ts";
import { familySchedules, kindsOf, schedulesOf, sourceOfRow } from "./source.service.ts";

type Fire = { occurrence: string; fireAt: number };

type Planning = {
  schedules: ReminderSchedule[];
  now: number;
  isMissing?: (key: Omit<PlannedRow, "fire">) => boolean;
};

export async function zoneOf(
  { sources }: ReminderDependencies,
  { memberId, schedule }: { memberId: string; schedule: ReminderSchedule | undefined },
): Promise<string> {
  return (await sources.timeZoneOf(memberId)) ?? schedule?.homeZone ?? fallbackTimeZone;
}

const searchLeadDays = 2;

// The first Occurrence that still fires ahead of now on this Recipient's clock; the search starts
// two days early, as zones lie up to 26 hours apart and a moment set in another zone may fall on
// the Recipient's day after next.
function upcoming(
  schedule: ReminderSchedule,
  { timeZone, now }: { timeZone: string; now: number },
): Fire | undefined {
  let occurrence = schedule.first(daysAfter(dateInZone(now, timeZone), -searchLeadDays));

  while (occurrence !== undefined && schedule.fireAt(occurrence, timeZone) < now) {
    occurrence = schedule.next(occurrence);
  }

  return occurrence === undefined
    ? undefined
    : { occurrence, fireAt: schedule.fireAt(occurrence, timeZone) };
}

async function plannedOf(
  dependencies: ReminderDependencies,
  { schedules, now, isMissing = () => true }: Planning,
): Promise<PlannedRow[]> {
  const planned: PlannedRow[] = [];

  for (const schedule of schedules) {
    for (const memberId of schedule.recipientIds) {
      const key = { source: schedule.kind, sourceId: schedule.sourceId, memberId };

      if (isMissing(key)) {
        const timeZone = await zoneOf(dependencies, { memberId, schedule });

        planned.push({ ...key, fire: upcoming(schedule, { timeZone, now }) });
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
    schedules: await schedulesOf(dependencies, holder),
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
  const rows = await dependencies.dispatch.ofMember({ familyId, memberId });
  const planned: PlannedRow[] = [];

  for (const row of rows.filter(({ source }) => source !== "digest")) {
    const source = await sourceOfRow(dependencies, row);
    const schedule = source?.schedule;
    const timeZone = await zoneOf(dependencies, { memberId, schedule });

    planned.push({
      source: row.source,
      sourceId: row.sourceId,
      memberId,
      fire: schedule && upcoming(schedule, { timeZone, now }),
    });
  }

  const { moved } = changesOf({ existing: rows, planned, now });

  await dependencies.dispatch.write({ familyId, now, added: [], moved, removedIds: [] }, () =>
    uuidv7(now),
  );
}

// Rows already there stay as they are, snoozes included: a Member who joined gets rows for every
// source that now reaches them, and one who left loses theirs.
export async function membershipChanged(dependencies: ReminderDependencies, familyId: string) {
  const now = dependencies.clock.now();

  await dependencies.dispatch.removeDeparted(familyId);

  const rows = await dependencies.dispatch.ofFamily(familyId);
  const kept = new Set(rows.map(rowKey));
  const planned = await plannedOf(dependencies, {
    schedules: await familySchedules(dependencies, familyId),
    now,
    isMissing: (key) => !kept.has(rowKey(key)),
  });

  await dependencies.dispatch.write(
    { familyId, now, ...changesOf({ existing: [], planned, now }) },
    () => uuidv7(now),
  );
}

// A row with a fire time but no Occurrence was written by a data migration, which cannot tell a
// Recipient's zone: it is planned now instead of sent.
export async function rowReplanned(dependencies: ReminderDependencies, row: DispatchRow) {
  const now = dependencies.clock.now();
  const source = await sourceOfRow(dependencies, row);
  const schedule = source?.schedule;
  const timeZone = await zoneOf(dependencies, { memberId: row.memberId, schedule });
  const fire = schedule && upcoming(schedule, { timeZone, now });

  await dependencies.dispatch.update(row.familyId, row.id, {
    occurrence: fire?.occurrence ?? null,
    nextFireAt: fire?.fireAt ?? null,
    lockedUntil: null,
    updatedAt: now,
  });
}
