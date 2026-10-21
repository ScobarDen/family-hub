import {
  uuidv7,
  type CareEntry,
  type CareEntryChange,
  type ExpenseSummary,
} from "@family-hub/contract";

import type { Membership } from "@/common/auth";
import type { Clock } from "@/common/clock";

import { columnsOf, summaryOf, toCareEntry } from "./care-entry.lib.ts";
import type { CareEntryRepo } from "./care-entry.repo.ts";

type CareEntryDependencies = { entries: CareEntryRepo; clock: Clock };

type Range = { from: number; to: number };

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
): Promise<CareEntry | undefined> {
  const row = await entries.find(family.id, entryId);

  return row && toCareEntry(row);
}

async function create(
  dependencies: CareEntryDependencies,
  membership: Membership,
  { petId, change }: { petId: string; change: CareEntryChange },
): Promise<CareEntry | undefined> {
  const { entries, clock } = dependencies;

  if (!(await entries.hasPet(membership.family.id, petId))) {
    return undefined;
  }

  const now = clock.now();
  const id = uuidv7(now);

  await entries.add({
    id,
    familyId: membership.family.id,
    petId,
    ...valuesOf(change),
    createdAt: now,
    createdBy: membership.member.id,
    updatedAt: now,
  });

  return current(dependencies, membership, id);
}

// Any Member edits an entry; its author stays the Member who wrote it.
async function update(
  dependencies: CareEntryDependencies,
  membership: Membership,
  { entryId, change }: { entryId: string; change: CareEntryChange },
): Promise<CareEntry | undefined> {
  if (!(await dependencies.entries.find(membership.family.id, entryId))) {
    return undefined;
  }

  await dependencies.entries.update(membership.family.id, entryId, {
    ...valuesOf(change),
    updatedAt: dependencies.clock.now(),
  });

  return current(dependencies, membership, entryId);
}

export type RemoveResult = { status: "deleted" } | { status: "not-found" };

async function remove(
  { entries }: CareEntryDependencies,
  { family }: Membership,
  entryId: string,
): Promise<RemoveResult> {
  if (!(await entries.find(family.id, entryId))) {
    return { status: "not-found" };
  }

  await entries.delete(family.id, entryId);

  return { status: "deleted" };
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

    async expenses({ family }: Membership, petId: string, range: Range): Promise<ExpenseSummary> {
      return summaryOf(await entries.expenses({ familyId: family.id, petId, ...range }));
    },
  };
}

export type CareEntryService = ReturnType<typeof createCareEntryService>;
