import {
  action,
  atom,
  computed,
  take,
  throwAbort,
  withAsyncData,
  withRollback,
  wrap,
} from "@reatom/core";

import { taskList, type FamilyMember, type Pet, type Task } from "@family-hub/contract";

import type { DeviceCache } from "@/common/device-cache";
import type { LiveVersion } from "@/common/live-updates";
import { rolledBackById, upserted, withoutId } from "@/common/records";

import type { TasksApi } from "./tasks.api.ts";

type Loaded<Item> = { data: () => Item[] | undefined };

// Members and Pets are the Family's shared queries, loaded once for every module.
export type SharedLists = { members: Loaded<FamilyMember>; pets: Loaded<Pet> };

type TaskList = {
  data: { (): Task[] | undefined; set: (tasks: Task[]) => unknown };
  error: () => Error | undefined;
  ready: () => boolean;
};

function settledOf(list: TaskList): Task[] | Error | undefined {
  return list.data() ?? list.error();
}

// A link may come before the list; a failed load ends the wait instead of leaving it hanging.
async function loadedOf(list: TaskList): Promise<Task[]> {
  const outcome =
    settledOf(list) ??
    (await wrap(
      take(
        () => settledOf(list),
        (next) => next ?? throwAbort(),
      ),
    ));

  if (outcome instanceof Error) {
    throw outcome;
  }

  return outcome;
}

// A fetch that left before a save would answer with the Task as it was, so it starts over.
function reatomKeeping(list: TaskList, reload: () => void) {
  function kept(tasks: Task[]): void {
    list.data.set(tasks);

    if (!list.ready()) {
      reload();
    }
  }

  return {
    keep: action((saved: Task) => {
      kept(upserted(list.data() ?? [], saved));
    }, "tasks.keep"),
    drop: action((taskId: string) => {
      kept(withoutId(list.data() ?? [], taskId));
    }, "tasks.drop"),
  };
}

export function reatomTasks({
  api,
  members,
  pets,
  liveVersion,
  deviceCache,
}: { api: TasksApi; deviceCache: Pick<DeviceCache, "withDeviceCache"> } & SharedLists &
  LiveVersion) {
  const version = atom(0, "tasks.version");
  const list = computed(async () => {
    version();
    liveVersion?.();

    return wrap(api.list());
  }, "tasks.list").extend(withAsyncData());

  list.data.extend(
    deviceCache.withDeviceCache({ key: "tasks", schema: taskList, version: 1 }),
    withRollback({ onRollback: rolledBackById }),
  );
  const reload = action(() => {
    version.set(version() + 1);
  }, "tasks.reload");

  return {
    list,
    reload,
    loaded: async () => loadedOf(list),
    members,
    pets,
    albums: computed(async () => wrap(api.albums()), "tasks.albums").extend(withAsyncData()),
    ...reatomKeeping(list, reload),
  };
}

export type TasksModel = ReturnType<typeof reatomTasks>;
