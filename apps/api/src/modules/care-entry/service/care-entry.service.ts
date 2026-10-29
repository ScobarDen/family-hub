import {
  uuidv7,
  type CareEntry,
  type CareEntryChange,
  type ExpenseSummary,
} from "@family-hub/contract";

import { bindFirst } from "@/common/bind.lib.ts";
import type { Clock } from "@/common/clock.lib.ts";
import type { PhotoLinks } from "@/common/photo-link.lib.ts";
import type { Membership } from "@/modules/auth";

import { careTitleOf, columnsOf, summaryOf } from "../care-entry.lib.ts";
import type { CareEntryRepo, CareEntryRow } from "../care-entry.repo.ts";
import { hasForeignPhotos, withPhotos } from "./entry-photo.service.ts";

// «Повторить» creates a Task linked to the Pet in the task module, which the app wires in.
type CareFollowUps = {
  followUp(
    membership: Membership,
    request: { petId: string; title: string; date: string },
  ): Promise<{ status: string }>;
};

type CareEntryDependencies = {
  entries: CareEntryRepo;
  clock: Clock;
  followUps: CareFollowUps;
  links: PhotoLinks;
};

type Range = { from: number; to: number };

export type CareRefusal = "not-found" | "pet-not-found" | "archived" | "photo-not-found";

type CareResult = { status: "ok"; entry: CareEntry } | { status: CareRefusal };

export type RemoveResult = { status: "deleted" } | { status: CareRefusal };

const repeatableKinds = new Set(["vaccination", "treatment", "vet_visit"]);

async function followUpOf(
  { followUps }: CareEntryDependencies,
  membership: Membership,
  { petId, change }: { petId: string; change: CareEntryChange },
): Promise<void> {
  if (change.repeatOn !== null && repeatableKinds.has(change.details.kind)) {
    await followUps.followUp(membership, {
      petId,
      title: careTitleOf(change.details),
      date: change.repeatOn,
    });
  }
}

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
  await followUpOf(dependencies, membership, { petId, change });

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
  await followUpOf(dependencies, membership, { petId: entry.petId, change });

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

  return { status: "deleted" };
}

export function createCareEntryService(dependencies: CareEntryDependencies) {
  const { entries } = dependencies;

  return {
    ...bindFirst(dependencies, { get: current, remove }),
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
