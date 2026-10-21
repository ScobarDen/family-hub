import { uuidv7, type CalendarEvent, type EventChange } from "@family-hub/contract";

import type { Membership } from "@/common/auth";
import type { Clock } from "@/common/clock";

import { columnsOf, toEvent } from "./event.lib.ts";
import type { EventRepo, EventRow } from "./event.repo.ts";

// The Reminders of an Event live in the reminder module; the app wires this port to it.
export type EventSchedule = { eventChanged(familyId: string, eventId: string): Promise<void> };

type EventDependencies = { events: EventRepo; clock: Clock; schedule: EventSchedule };

export type EventRefusal = "not-found" | "not-owner" | "visibility-one-way";

export type EventResult = { status: "ok"; event: CalendarEvent } | { status: EventRefusal };

async function visible(
  { events }: EventDependencies,
  { family, member }: Membership,
  eventId: string,
): Promise<EventRow | undefined> {
  const row = await events.find({ familyId: family.id, eventId });

  return row?.visibility === "private" && row.ownerMemberId !== member.id ? undefined : row;
}

async function current(
  dependencies: EventDependencies,
  membership: Membership,
  eventId: string,
): Promise<EventResult> {
  const row = await visible(dependencies, membership, eventId);

  return row
    ? { status: "ok", event: toEvent(row, membership.member.id) }
    : { status: "not-found" };
}

async function create(
  dependencies: EventDependencies,
  membership: Membership,
  change: EventChange,
): Promise<EventResult> {
  const now = dependencies.clock.now();
  const id = uuidv7(now);

  await dependencies.events.add({
    id,
    familyId: membership.family.id,
    ownerMemberId: membership.member.id,
    ...columnsOf(change),
    createdAt: now,
    createdBy: membership.member.id,
    updatedAt: now,
  });

  await dependencies.schedule.eventChanged(membership.family.id, id);

  return current(dependencies, membership, id);
}

// An edit applies to the whole series; single Occurrences are only ever skipped.
async function update(
  dependencies: EventDependencies,
  membership: Membership,
  { eventId, change }: { eventId: string; change: EventChange },
): Promise<EventResult> {
  const row = await visible(dependencies, membership, eventId);

  if (!row) {
    return { status: "not-found" };
  }

  // Others may already rely on a Shared Event, so it never turns Private.
  if (row.visibility === "shared" && change.visibility === "private") {
    return { status: "visibility-one-way" };
  }

  await dependencies.events.update(
    { familyId: membership.family.id, eventId },
    { ...columnsOf(change), updatedAt: dependencies.clock.now() },
  );

  await dependencies.schedule.eventChanged(membership.family.id, eventId);

  return current(dependencies, membership, eventId);
}

async function skip(
  dependencies: EventDependencies,
  membership: Membership,
  { eventId, date }: { eventId: string; date: string },
): Promise<EventResult> {
  const row = await visible(dependencies, membership, eventId);

  if (!row) {
    return { status: "not-found" };
  }

  await dependencies.events.update(
    { familyId: membership.family.id, eventId },
    {
      skippedDates: [...new Set([...row.skippedDates, date])].toSorted(),
      updatedAt: dependencies.clock.now(),
    },
  );

  await dependencies.schedule.eventChanged(membership.family.id, eventId);

  return current(dependencies, membership, eventId);
}

export type DeleteResult = { status: "deleted" } | { status: EventRefusal };

async function remove(
  dependencies: EventDependencies,
  membership: Membership,
  eventId: string,
): Promise<DeleteResult> {
  const row = await visible(dependencies, membership, eventId);

  if (!row) {
    return { status: "not-found" };
  }

  if (row.ownerMemberId !== membership.member.id) {
    return { status: "not-owner" };
  }

  await dependencies.events.delete({ familyId: membership.family.id, eventId });
  await dependencies.schedule.eventChanged(membership.family.id, eventId);

  return { status: "deleted" };
}

export function createEventService(dependencies: EventDependencies) {
  return {
    async list({ family, member }: Membership): Promise<CalendarEvent[]> {
      const rows = await dependencies.events.listVisible(family.id, member.id);

      return rows.map((row) => toEvent(row, member.id));
    },
    create: async (membership: Membership, change: EventChange) =>
      create(dependencies, membership, change),
    update: async (membership: Membership, eventId: string, change: EventChange) =>
      update(dependencies, membership, { eventId, change }),
    skip: async (membership: Membership, eventId: string, date: string) =>
      skip(dependencies, membership, { eventId, date }),
    remove: async (membership: Membership, eventId: string) =>
      remove(dependencies, membership, eventId),
  };
}

export type EventService = ReturnType<typeof createEventService>;
