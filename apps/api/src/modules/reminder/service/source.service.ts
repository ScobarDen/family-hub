import type { DispatchSource } from "@/modules/db";

import { holderIdOf } from "../reminder.lib.ts";
import type { HolderKind, ReminderDependencies, Source, SourceHolder } from "../reminder.types.ts";
import type { DispatchRow } from "../repo/dispatch.repo.ts";
import { digestSources } from "./digest-source.service.ts";
import { birthdaySources } from "./pet-source.service.ts";
import { taskSources } from "./task-source.service.ts";

type SourceKind = {
  holder: HolderKind;
  load: (dependencies: ReminderDependencies, holder: SourceHolder) => Promise<Source[]>;
};

const sourceKinds: Record<DispatchSource, SourceKind> = {
  task: { holder: "task", load: taskSources },
  pet_birthday: { holder: "pet", load: birthdaySources },
  digest: { holder: "member", load: digestSources },
};

function isSourceKind(key: string): key is DispatchSource {
  return key in sourceKinds;
}

export function kindsOf(holder: HolderKind): DispatchSource[] {
  return Object.keys(sourceKinds)
    .filter(isSourceKind)
    .filter((kind) => sourceKinds[kind].holder === holder);
}

export async function sourcesOf(
  dependencies: ReminderDependencies,
  { kind, ...holder }: SourceHolder & { kind: HolderKind },
): Promise<Source[]> {
  const groups = await Promise.all(
    kindsOf(kind).map(async (source) => sourceKinds[source].load(dependencies, holder)),
  );

  return groups.flat();
}

// A row whose source is gone, or no longer has its id, reminds of nothing. Its kind can be gone
// too: a Worker one release behind keeps writing the kinds it knows until the deploy finishes.
export async function sourceOfRow(
  dependencies: ReminderDependencies,
  { familyId, source, sourceId }: Pick<DispatchRow, "familyId" | "source" | "sourceId">,
): Promise<Source | undefined> {
  if (!isSourceKind(source)) {
    return undefined;
  }

  const sources = await sourceKinds[source].load(dependencies, {
    familyId,
    id: holderIdOf(sourceId),
  });

  return sources.find((found) => found.sourceId === sourceId);
}

export async function familySources(
  dependencies: ReminderDependencies,
  familyId: string,
): Promise<Source[]> {
  const holders = await dependencies.sources.holdersOf(familyId);
  const memberIds = await dependencies.sources.memberIdsOf(familyId);
  const groups = await Promise.all(
    [...holders, ...memberIds.map((id) => ({ kind: "member" as const, id }))].map(async (holder) =>
      sourcesOf(dependencies, { ...holder, familyId }),
    ),
  );

  return groups.flat();
}
