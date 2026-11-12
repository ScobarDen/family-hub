import type { DispatchSource } from "@/modules/db";

import type {
  HolderKind,
  ReminderDependencies,
  ReminderSchedule,
  ReminderSource,
  SourceHolder,
} from "../reminder.types.ts";
import type { DispatchRow } from "../repo/dispatch.repo.ts";
import { digestSources } from "./digest-source.service.ts";
import { birthdaySources } from "./pet-source.service.ts";
import { taskSourceOf, taskSources } from "./task-source.service.ts";

type SourceRef = { familyId: string; sourceId: string };

type SourceKind = {
  holder: HolderKind;
  load: (dependencies: ReminderDependencies, holder: SourceHolder) => Promise<ReminderSource[]>;
  one: (dependencies: ReminderDependencies, ref: SourceRef) => Promise<ReminderSource | undefined>;
};

// A Pet and a Member hold one source each, named by the holder's own id.
function onlySourceOf(load: SourceKind["load"]): SourceKind["one"] {
  return async (dependencies, { familyId, sourceId }) => {
    const [source] = await load(dependencies, { familyId, id: sourceId });

    return source;
  };
}

const sourceKinds: Record<DispatchSource, SourceKind> = {
  task: { holder: "task", load: taskSources, one: taskSourceOf },
  pet_birthday: { holder: "pet", load: birthdaySources, one: onlySourceOf(birthdaySources) },
  digest: { holder: "member", load: digestSources, one: onlySourceOf(digestSources) },
};

function isSourceKind(key: string): key is DispatchSource {
  return key in sourceKinds;
}

export function kindsOf(holder: HolderKind): DispatchSource[] {
  return Object.keys(sourceKinds)
    .filter(isSourceKind)
    .filter((kind) => sourceKinds[kind].holder === holder);
}

export async function schedulesOf(
  dependencies: ReminderDependencies,
  { kind, ...holder }: SourceHolder & { kind: HolderKind },
): Promise<ReminderSchedule[]> {
  const groups = await Promise.all(
    kindsOf(kind).map(async (source) => sourceKinds[source].load(dependencies, holder)),
  );

  return groups.flat().map(({ schedule }) => schedule);
}

// A row whose source is gone, or no longer has its id, reminds of nothing. Its kind can be gone
// too: a Worker one release behind keeps writing the kinds it knows until the deploy finishes.
export async function sourceOfRow(
  dependencies: ReminderDependencies,
  { familyId, source, sourceId }: Pick<DispatchRow, "familyId" | "source" | "sourceId">,
): Promise<ReminderSource | undefined> {
  return isSourceKind(source)
    ? sourceKinds[source].one(dependencies, { familyId, sourceId })
    : undefined;
}

export async function familySchedules(
  dependencies: ReminderDependencies,
  familyId: string,
): Promise<ReminderSchedule[]> {
  const holders = await dependencies.sources.holdersOf(familyId);
  const memberIds = await dependencies.sources.memberIdsOf(familyId);
  const groups = await Promise.all(
    [...holders, ...memberIds.map((id) => ({ kind: "member" as const, id }))].map(async (holder) =>
      schedulesOf(dependencies, { ...holder, familyId }),
    ),
  );

  return groups.flat();
}
