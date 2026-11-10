import { action, atom, computed, withAsyncData, withRollback, wrap } from "@reatom/core";
import type { z } from "zod";

import type { DeviceCache } from "@/modules/device-cache";

// `stale` shows the data it has while its last refresh failed.
export type ResourceStatus = "loading" | "failed" | "ready" | "stale";

type RollbackStates<Data> = { beforeState: Data; transactionState: Data; currentState: Data };

export type LiveResourceOptions<Data> = {
  name: string;
  // Required: a read that does not follow its live version never refreshes after a write.
  liveVersion: () => number;
  load: () => Promise<Data>;
  cache?: Pick<DeviceCache, "withDeviceCache"> & {
    key: string;
    schema: z.ZodType<Data>;
    version: number;
    // undefined leaves the copy already on the device.
    cachedPart?: (state: Data) => Data | undefined;
  };
  // An optimistic change the server refuses returns to what was shown: "whole" restores the value
  // unless a change made meanwhile replaced it, a function decides what to keep.
  rollback?: "whole" | ((states: RollbackStates<NoInfer<Data>>) => NoInfer<Data>);
};

type Loaded = { data: () => unknown; error: () => unknown; ready: () => boolean };

function statusOf({ data, error, ready }: Loaded): ResourceStatus {
  if (error() !== undefined) {
    return data() === undefined ? "failed" : "stale";
  }

  return data() !== undefined || ready() ? "ready" : "loading";
}

export function reatomLiveResource<Data>({
  name,
  liveVersion,
  load,
  cache,
  rollback,
}: LiveResourceOptions<Data>) {
  const version = atom(0, `${name}.version`);
  const resource = computed(async () => {
    version();
    liveVersion();

    return wrap(load());
  }, name).extend(withAsyncData());
  const reload = action(() => {
    version.set(version() + 1);
  }, `${name}.reload`);

  if (cache !== undefined) {
    const { withDeviceCache, ...options } = cache;

    resource.data.extend(withDeviceCache(options));
  }

  if (rollback !== undefined) {
    resource.data.extend(withRollback(rollback === "whole" ? {} : { onRollback: rollback }));
  }

  return {
    data: () => resource.data(),
    status: computed(() => statusOf(resource), `${name}.status`),
    reload,
    // A fetch that left before this change would answer without it, so it starts over.
    change: action((update: (current: Data | undefined) => Data) => {
      resource.data.set(update(resource.data()));

      if (!resource.ready()) {
        reload();
      }
    }, `${name}.change`),
  };
}

export type LiveResource<Data> = ReturnType<typeof reatomLiveResource<Data>>;
