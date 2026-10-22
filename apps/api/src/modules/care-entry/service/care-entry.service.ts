import {
  uuidv7,
  type CareEntry,
  type CareEntryChange,
  type DueDateItem,
  type ExpenseSummary,
} from "@family-hub/contract";
import { dateInZone } from "@family-hub/recurrence";

import type { Membership } from "@/common/auth";
import { bindFirst } from "@/common/bind";
import { fallbackTimeZone, type Clock } from "@/common/clock";
import type { PhotoLinks } from "@/common/photo-link";

import { columnsOf, summaryOf, toDueDateItem } from "../care-entry.lib.ts";
import type { CareEntryRepo, CareEntryRow } from "../care-entry.repo.ts";
import { openDueDates } from "../due-date/index.ts";
import { hasForeignPhotos, withPhotos } from "./entry-photo.service.ts";

// A new entry may close or move a Due Date, whose Reminders live in the reminder module.
type CareSchedule = {
  sourceChanged(familyId: string, source: { kind: "pet"; id: string }): Promise<void>;
};

type CareEntryDependencies = {
  entries: CareEntryRepo;
  clock: Clock;
  schedule: CareSchedule;
  links: PhotoLinks;
};

type Range = { from: number; to: number };

export type CareRefusal = "not-found" | "pet-not-found" | "archived" | "photo-not-found";

type CareResult = { status: "ok"; entry: CareEntry } | { status: CareRefusal };

export type RemoveResult = { status: "deleted" } | { status: CareRefusal };

function valuesOf(change: CareEntryChange) {
  return {
    kind: change.details.kind,
    occurredAt: change.occurredAt,
    note: change.note,
    details: change.details,
    ...columnsOf(change.details),
  };
}

async function current(
  dependencies: CareEntryDependencies,
  membership: Membership,
  entryId: string,
): Promise<CareResult> {
  const row = await dependencies.entries.find(membership.family.id, entryId);
  const [entry] = row ? await withPhotos(dependencies, membership, [row]) : [];

  return entry ? { status: "ok", entry } : { status: "not-found" };
}

// An archived Pet keeps its journal to read; nothing is written to it until it is unarchived.
async function writablePet(
  { entries }: CareEntryDependencies,
  { family }: Membership,
  petId: string,
): Promise<CareRefusal | undefined> {
  const pet = await entries.petOf(family.id, petId);

  if (!pet) {
    return "pet-not-found";
  }

  return pet.archivedAt === null ? undefined : "archived";
}

async function writableEntry(
  dependencies: CareEntryDependencies,
  membership: Membership,
  entryId: string,
): Promise<CareEntryRow | CareRefusal> {
  const entry = await dependencies.entries.find(membership.family.id, entryId);

  if (entry === undefined) {
    return "not-found";
  }

  return (await writablePet(dependencies, membership, entry.petId)) ?? entry;
}

// Only an entry with a Due Date, before or after the change, moves the Pet's Reminders.
async function scheduleIfDue(
  { schedule }: CareEntryDependencies,
  { family }: Membership,
  { petId, dueKeys }: { petId: string; dueKeys: Array<string | null> },
): Promise<void> {
  if (dueKeys.some((dueKey) => dueKey !== null)) {
    await schedule.sourceChanged(family.id, { kind: "pet", id: petId });
  }
}

async function photoRefusal(
  dependencies: CareEntryDependencies,
  membership: Membership,
  { photoIds }: CareEntryChange,
): Promise<CareRefusal | undefined> {
  return (await hasForeignPhotos(dependencies, membership, photoIds))
    ? "photo-not-found"
    : undefined;
}

async function create(
  dependencies: CareEntryDependencies,
  membership: Membership,
  { petId, change }: { petId: string; change: CareEntryChange },
): Promise<CareResult> {
  const refusal =
    (await writablePet(dependencies, membership, petId)) ??
    (await photoRefusal(dependencies, membership, change));

  if (refusal !== undefined) {
    return { status: refusal };
  }

  const now = dependencies.clock.now();
  const id = uuidv7(now);
  const values = valuesOf(change);

  await dependencies.entries.add({
    id,
    familyId: membership.family.id,
    petId,
    ...values,
    createdAt: now,
    createdBy: membership.member.id,
    updatedAt: now,
  });
  await dependencies.entries.setPhotos({
    familyId: membership.family.id,
    entryId: id,
    photoIds: change.photoIds,
  });
  await scheduleIfDue(dependencies, membership, { petId, dueKeys: [values.dueKey] });

  return current(dependencies, membership, id);
}

// Any Member edits an entry; its author stays the Member who wrote it.
async function update(
  dependencies: CareEntryDependencies,
  membership: Membership,
  { entryId, change }: { entryId: string; change: CareEntryChange },
): Promise<CareResult> {
  const entry = await writableEntry(dependencies, membership, entryId);

  if (typeof entry === "string") {
    return { status: entry };
  }

  const refusal = await photoRefusal(dependencies, membership, change);

  if (refusal !== undefined) {
    return { status: refusal };
  }

  const values = valuesOf(change);

  await dependencies.entries.update(membership.family.id, entryId, {
    ...values,
    updatedAt: dependencies.clock.now(),
  });
  await dependencies.entries.setPhotos({
    familyId: membership.family.id,
    entryId,
    photoIds: change.photoIds,
  });
  await scheduleIfDue(dependencies, membership, {
    petId: entry.petId,
    dueKeys: [entry.dueKey, values.dueKey],
  });

  return current(dependencies, membership, entryId);
}

async function remove(
  dependencies: CareEntryDependencies,
  membership: Membership,
  entryId: string,
): Promise<RemoveResult> {
  const entry = await writableEntry(dependencies, membership, entryId);

  if (typeof entry === "string") {
    return { status: entry };
  }

  await dependencies.entries.delete(membership.family.id, entryId);
  await scheduleIfDue(dependencies, membership, { petId: entry.petId, dueKeys: [entry.dueKey] });

  return { status: "deleted" };
}

async function dueDates(
  { entries, clock }: CareEntryDependencies,
  { family, member }: Membership,
  petId: string,
): Promise<DueDateItem[]> {
  const pet = await entries.petOf(family.id, petId);
  const rows = await entries.dueCandidates(family.id, petId);
  const today = dateInZone(clock.now(), member.timeZone ?? fallbackTimeZone);
  const open = openDueDates({ pets: pet === undefined ? [] : [pet], entries: rows });

  return open.map((due) => toDueDateItem(due, today));
}

export function createCareEntryService(dependencies: CareEntryDependencies) {
  const { entries } = dependencies;

  return {
    ...bindFirst(dependencies, { get: current, remove, dueDates }),
    async list(membership: Membership, petId: string): Promise<CareEntry[]> {
      const rows = await entries.list(membership.family.id, petId);

      return withPhotos(dependencies, membership, rows);
    },
    create: async (membership: Membership, petId: string, change: CareEntryChange) =>
      create(dependencies, membership, { petId, change }),
    update: async (membership: Membership, entryId: string, change: CareEntryChange) =>
      update(dependencies, membership, { entryId, change }),

    async expenses({ family }: Membership, petId: string, range: Range): Promise<ExpenseSummary> {
      return summaryOf(await entries.expenses({ familyId: family.id, petId, ...range }));
    },
  };
}

export type CareEntryService = ReturnType<typeof createCareEntryService>;
