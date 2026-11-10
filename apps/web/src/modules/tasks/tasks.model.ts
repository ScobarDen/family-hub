import { action, take, throwAbort, wrap } from "@reatom/core";

import { taskList, type FamilyMember, type Pet, type Task } from "@family-hub/contract";

import { rolledBackById, upserted, withoutId } from "@/common/records.lib.ts";
import type { DeviceCache } from "@/modules/device-cache";
import { reatomLiveResource, type LiveResource } from "@/modules/live-resource";
import type { LiveVersion } from "@/modules/live-updates";

import type { TasksApi } from "./tasks.api.ts";

type Loaded<Item> = { data: () => Item[] | undefined };

// Members and Pets are the Family's shared queries, loaded once for every module.
export type SharedLists = { members: Loaded<FamilyMember>; pets: Loaded<Pet> };

type TaskList = Pick<LiveResource<Task[]>, "data" | "status" | "change">;

function settledOf(list: TaskList): Task[] | Error | undefined {
  return (
    list.data() ?? (list.status() === "failed" ? new Error("The Tasks did not load") : undefined)
  );
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

type TasksModelDependencies = {
  api: TasksApi;
  deviceCache: Pick<DeviceCache, "withDeviceCache">;
  // The Albums a Task may link to follow their own module.
  albumsVersion: () => number;
} & SharedLists &
  LiveVersion;

export function reatomTasks(dependencies: TasksModelDependencies) {
  const { api, members, pets, liveVersion, albumsVersion, deviceCache } = dependencies;
  const list = reatomLiveResource({
    name: "tasks.list",
    liveVersion,
    load: async () => api.list(),
    cache: {
      withDeviceCache: deviceCache.withDeviceCache,
      key: "tasks",
      schema: taskList,
      version: 1,
    },
    rollback: { onRollback: rolledBackById },
  });

  return {
    list,
    reload: list.reload,
    loaded: async () => loadedOf(list),
    members,
    pets,
    albums: reatomLiveResource({
      name: "tasks.albums",
      liveVersion: albumsVersion,
      load: async () => api.albums(),
    }),
    keep: action((saved: Task) => {
      list.change((tasks) => upserted(tasks ?? [], saved));
    }, "tasks.keep"),
    drop: action((taskId: string) => {
      list.change((tasks) => withoutId(tasks ?? [], taskId));
    }, "tasks.drop"),
  };
}

export type TasksModel = ReturnType<typeof reatomTasks>;
