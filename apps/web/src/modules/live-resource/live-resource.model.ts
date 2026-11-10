import { action, atom, computed, withAsyncData, withRollback, wrap } from "@reatom/core";
import type { z } from "zod";

import type { DeviceCache } from "@/modules/device-cache";

export type ResourceStatus = "loading" | "failed" | "ready";

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
  // Optimistic changes return to what was shown when the server refuses them; by default the
  // whole value, unless a change made meanwhile replaced it.
  rollback?: { onRollback?: (states: RollbackStates<Data>) => Data };
};

type Loaded = { data: () => unknown; error: () => unknown; ready: () => boolean };

// What was shown stays shown: a failed refresh is not a failure while there is data.
function statusOf({ data, error, ready }: Loaded): ResourceStatus {
  if (data() !== undefined) {
    return "ready";
  }

  if (error() !== undefined) {
    return "failed";
  }

  return ready() ? "ready" : "loading";
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
    resource.data.extend(withRollback(rollback));
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
