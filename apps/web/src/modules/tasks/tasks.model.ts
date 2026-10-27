import { action, atom, computed, withAsyncData, wrap } from "@reatom/core";

import type { FamilyMember, Pet, Task } from "@family-hub/contract";

import type { LiveVersion } from "@/common/live-updates";
import { upserted, withoutId } from "@/common/records";

import type { TasksApi } from "./tasks.api.ts";

type Loaded<Item> = { data: () => Item[] | undefined };

// Members and Pets are the Family's shared queries, loaded once for every module.
export type SharedLists = { members: Loaded<FamilyMember>; pets: Loaded<Pet> };

export function reatomTasks({
  api,
  members,
  pets,
  liveVersion,
}: { api: TasksApi } & SharedLists & LiveVersion) {
  const version = atom(0, "tasks.version");
  const list = computed(async () => {
    version();
    liveVersion?.();

    return wrap(api.list());
  }, "tasks.list").extend(withAsyncData());

  return {
    list,
    reload: action(() => {
      version.set(version() + 1);
    }, "tasks.reload"),
    members,
    pets,
    albums: computed(async () => wrap(api.albums()), "tasks.albums").extend(withAsyncData()),

    keep: action((saved: Task) => {
      list.data.set(upserted(list.data() ?? [], saved));
    }, "tasks.keep"),
    drop: action((taskId: string) => {
      list.data.set(withoutId(list.data() ?? [], taskId));
    }, "tasks.drop"),
  };
}

export type TasksModel = ReturnType<typeof reatomTasks>;
