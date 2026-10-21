import {
  uuidv7,
  type CareEntry,
  type CareEntryChange,
  type DueDateItem,
  type ExpenseSummary,
} from "@family-hub/contract";

import type { Membership } from "@/common/auth";
import type { Clock } from "@/common/clock";

import { columnsOf, openDueDates, summaryOf, toCareEntry, todayIn } from "./care-entry.lib.ts";
import type { CareEntryRepo } from "./care-entry.repo.ts";

// A new entry may close or move a Due Date, whose Reminders live in the reminder module.
export type CareSchedule = { petChanged(familyId: string, petId: string): Promise<void> };

type CareEntryDependencies = { entries: CareEntryRepo; clock: Clock; schedule: CareSchedule };

type Range = { from: number; to: number };

export type CareRefusal = "not-found" | "pet-not-found" | "archived";

export type CareResult = { status: "ok"; entry: CareEntry } | { status: CareRefusal };

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
  { entries }: CareEntryDependencies,
  { family }: Membership,
  entryId: string,
): Promise<CareResult> {
  const row = await entries.find(family.id, entryId);

  return row ? { status: "ok", entry: toCareEntry(row) } : { status: "not-found" };
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
): Promise<CareRefusal | undefined> {
  const entry = await dependencies.entries.find(membership.family.id, entryId);

  return entry ? writablePet(dependencies, membership, entry.petId) : "not-found";
}

async function scheduleOfEntry(
  { entries, schedule }: CareEntryDependencies,
  { family }: Membership,
  entryId: string,
): Promise<void> {
  const entry = await entries.find(family.id, entryId);

  if (entry !== undefined) {
    await schedule.petChanged(family.id, entry.petId);
  }
}

async function create(
  dependencies: CareEntryDependencies,
  membership: Membership,
  { petId, change }: { petId: string; change: CareEntryChange },
): Promise<CareResult> {
  const refusal = await writablePet(dependencies, membership, petId);

  if (refusal !== undefined) {
    return { status: refusal };
  }

  const now = dependencies.clock.now();
  const id = uuidv7(now);

  await dependencies.entries.add({
    id,
    familyId: membership.family.id,
    petId,
    ...valuesOf(change),
    createdAt: now,
    createdBy: membership.member.id,
    updatedAt: now,
  });
  await dependencies.schedule.petChanged(membership.family.id, petId);

  return current(dependencies, membership, id);
}

// Any Member edits an entry; its author stays the Member who wrote it.
async function update(
  dependencies: CareEntryDependencies,
  membership: Membership,
  { entryId, change }: { entryId: string; change: CareEntryChange },
): Promise<CareResult> {
  const refusal = await writableEntry(dependencies, membership, entryId);

  if (refusal !== undefined) {
    return { status: refusal };
  }

  await dependencies.entries.update(membership.family.id, entryId, {
    ...valuesOf(change),
    updatedAt: dependencies.clock.now(),
  });
  await scheduleOfEntry(dependencies, membership, entryId);

  return current(dependencies, membership, entryId);
}

async function remove(
  dependencies: CareEntryDependencies,
  membership: Membership,
  entryId: string,
): Promise<RemoveResult> {
  const refusal = await writableEntry(dependencies, membership, entryId);

  if (refusal !== undefined) {
    return { status: refusal };
  }

  const entry = await dependencies.entries.find(membership.family.id, entryId);

  await dependencies.entries.delete(membership.family.id, entryId);

  if (entry !== undefined) {
    await dependencies.schedule.petChanged(membership.family.id, entry.petId);
  }

  return { status: "deleted" };
}

async function dueDates(
  { entries, clock }: CareEntryDependencies,
  { family, member }: Membership,
  petId: string,
): Promise<DueDateItem[]> {
  const rows = await entries.dueCandidates(family.id, petId);
  const today = todayIn(await entries.timeZoneOf(member.id), clock.now());

  return openDueDates(rows, today);
}

export function createCareEntryService(dependencies: CareEntryDependencies) {
  const { entries } = dependencies;

  return {
    async list({ family }: Membership, petId: string): Promise<CareEntry[]> {
      const rows = await entries.list(family.id, petId);

      return rows.map(toCareEntry);
    },
    create: async (membership: Membership, petId: string, change: CareEntryChange) =>
      create(dependencies, membership, { petId, change }),
    update: async (membership: Membership, entryId: string, change: CareEntryChange) =>
      update(dependencies, membership, { entryId, change }),
    remove: async (membership: Membership, entryId: string) =>
      remove(dependencies, membership, entryId),
    dueDates: async (membership: Membership, petId: string) =>
      dueDates(dependencies, membership, petId),

    async expenses({ family }: Membership, petId: string, range: Range): Promise<ExpenseSummary> {
      return summaryOf(await entries.expenses({ familyId: family.id, petId, ...range }));
    },
  };
}

export type CareEntryService = ReturnType<typeof createCareEntryService>;
