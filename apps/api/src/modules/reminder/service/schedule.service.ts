import { uuidv7 } from "@family-hub/contract";
import { dateInZone, dayBefore } from "@family-hub/recurrence";

import { fallbackTimeZone } from "../reminder.lib.ts";
import type { Owner, OwnerKind, ReminderDependencies, Source } from "../reminder.types.ts";
import type { DispatchRow, NewRow } from "../repo/dispatch.repo.ts";
import { familySources, kindsOf, sourceOfRow, sourcesOf } from "./source.service.ts";

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

async function rowsOf(
  dependencies: ReminderDependencies,
  { source, memberIds, now }: { source: Source; memberIds: string[]; now: number },
): Promise<NewRow[]> {
  const rows: NewRow[] = [];

  for (const memberId of memberIds) {
    const fire = upcoming(source, {
      timeZone: await zoneOf(dependencies, { memberId, source }),
      now,
    });

    if (fire !== undefined) {
      rows.push({
        source: source.kind,
        sourceId: source.sourceId,
        memberId,
        occurrence: fire.occurrence,
        nextFireAt: fire.fireAt,
      });
    }
  }

  return rows;
}

// Called whenever an owner of sources changes: its rows are rewritten for the Recipients it has now.
export async function sourceChanged(
  dependencies: ReminderDependencies,
  owner: Owner & { kind: OwnerKind },
): Promise<void> {
  const now = dependencies.clock.now();
  const sources = await sourcesOf(dependencies, owner);
  const rows = await Promise.all(
    sources.map(async (source) =>
      rowsOf(dependencies, { source, memberIds: source.recipientIds, now }),
    ),
  );

  await dependencies.dispatch.replace(
    {
      familyId: owner.familyId,
      sources: kindsOf(owner.kind),
      ownerId: owner.id,
      rows: rows.flat(),
      now,
    },
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

    await dependencies.dispatch.update(row.id, {
      occurrence: fire?.occurrence ?? null,
      nextFireAt: fire?.fireAt ?? null,
      updatedAt: now,
    });
  }
}

function rowKey({
  source,
  sourceId,
  memberId,
}: Pick<DispatchRow, "source" | "sourceId" | "memberId">) {
  return `${source}|${sourceId}|${memberId}`;
}

// Rows already there stay as they are, snoozes included: a Member who joined gets rows for every
// source that now reaches them, and one who left loses theirs along with their chosen-Recipient places.
export async function membershipChanged(dependencies: ReminderDependencies, familyId: string) {
  const now = dependencies.clock.now();

  await dependencies.reminders.removeDepartedRecipients(familyId);
  await dependencies.dispatch.removeDeparted(familyId);

  const kept = await dependencies.dispatch.ofFamily(familyId);
  const existing = new Set(kept.map(rowKey));
  const rows: NewRow[] = [];

  for (const source of await familySources(dependencies, familyId)) {
    const memberIds = source.recipientIds.filter(
      (memberId) =>
        !existing.has(rowKey({ source: source.kind, sourceId: source.sourceId, memberId })),
    );

    rows.push(...(await rowsOf(dependencies, { source, memberIds, now })));
  }

  await dependencies.dispatch.add({ familyId, rows, now }, () => uuidv7(now));
}
