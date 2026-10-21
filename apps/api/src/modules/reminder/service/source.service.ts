import type { DispatchSource } from "@/common/db";

import { ownerIdOf } from "../reminder.lib.ts";
import type { Owner, OwnerKind, ReminderDependencies, Source } from "../reminder.types.ts";
import type { DispatchRow } from "../repo/dispatch.repo.ts";
import { eventSources, reminderSources } from "./calendar-source.service.ts";
import { digestSources } from "./digest-source.service.ts";
import { birthdaySources, dueSources } from "./pet-source.service.ts";
import { planSources } from "./plan-source.service.ts";

type SourceKind = {
  owner: OwnerKind;
  load: (dependencies: ReminderDependencies, owner: Owner) => Promise<Source[]>;
};

// Every kind of source and what owns it: a new kind is one entry here plus its loader.
const sourceKinds: Record<DispatchSource, SourceKind> = {
  reminder: { owner: "reminder", load: reminderSources },
  event: { owner: "event", load: eventSources },
  pet_birthday: { owner: "pet", load: birthdaySources },
  pet_due: { owner: "pet", load: dueSources },
  plan: { owner: "plan", load: planSources },
  digest: { owner: "member", load: digestSources },
};

function isSourceKind(key: string): key is DispatchSource {
  return key in sourceKinds;
}

export function kindsOf(owner: OwnerKind): DispatchSource[] {
  return Object.keys(sourceKinds)
    .filter(isSourceKind)
    .filter((kind) => sourceKinds[kind].owner === owner);
}

export async function sourcesOf(
  dependencies: ReminderDependencies,
  { kind, ...owner }: Owner & { kind: OwnerKind },
): Promise<Source[]> {
  const groups = await Promise.all(
    kindsOf(kind).map(async (source) => sourceKinds[source].load(dependencies, owner)),
  );

  return groups.flat();
}

// A row whose source is gone, or no longer has its id, reminds of nothing.
export async function sourceOfRow(
  dependencies: ReminderDependencies,
  { familyId, source, sourceId }: Pick<DispatchRow, "familyId" | "source" | "sourceId">,
): Promise<Source | undefined> {
  const sources = await sourceKinds[source].load(dependencies, {
    familyId,
    id: ownerIdOf(sourceId),
  });

  return sources.find((found) => found.sourceId === sourceId);
}

// Every source a Family keeps, read when its Members change; a digest belongs to its Member alone.
export async function familySources(
  dependencies: ReminderDependencies,
  familyId: string,
): Promise<Source[]> {
  const owners = await dependencies.sources.ownersOf(familyId);
  const groups = await Promise.all(
    owners.map(async (owner) => sourcesOf(dependencies, { ...owner, familyId })),
  );

  return groups.flat();
}
