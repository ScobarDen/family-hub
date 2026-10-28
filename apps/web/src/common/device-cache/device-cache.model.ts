import {
  action,
  type AtomLike,
  type AtomState,
  type Ext,
  isPersistRecord,
  type PersistRecord,
  reatomPersist,
  wrap,
} from "@reatom/core";
import { z } from "zod";

import type { DeviceStorage } from "@/common/telegram";

const keptForMs = 2_592_000_000;
const ownerKey = "device-cache.owner";

export type CacheOwner = { memberId: string; familyId: string };

const cacheOwner = z.object({ memberId: z.string(), familyId: z.string() });

type Contract = { contract: z.ZodType };

// A DeviceStorage error (a full quota, a broken value) costs only the cache, never the screen.
async function promised<Result>(
  call: (callback: (error: string | null, result?: Result) => void) => void,
): Promise<Result | undefined> {
  return new Promise((resolve) => {
    call((error, result) => {
      resolve(error === null ? result : undefined);
    });
  });
}

function parsedJson(value: string | null | undefined): unknown {
  try {
    return value === null || value === undefined ? undefined : JSON.parse(value);
  } catch {
    return undefined;
  }
}

function reatomDeviceStorage(storage: DeviceStorage) {
  return {
    read: async (key: string) =>
      parsedJson(
        await promised<string | null>((callback) => {
          storage.getItem(key, callback);
        }),
      ),
    write: async (key: string, value: unknown) =>
      promised<boolean>((callback) => {
        storage.setItem(key, JSON.stringify(value), callback);
      }),
    clear: async () =>
      promised<boolean>((callback) => {
        storage.clear(callback);
      }),
  };
}

type Device = ReturnType<typeof reatomDeviceStorage>;

// Without DeviceStorage, Reatom's in-memory record cache is the whole storage.
// Showing a cached value writes it back through the atom; skipping that keeps the 30 days counted from the load.
function reatomCachePersist(device: Device | undefined) {
  const shown = new Map<string, unknown>();

  async function read({
    key,
    contract,
  }: { key: string } & Contract): Promise<PersistRecord | null> {
    const record = await device?.read(key);

    if (!isPersistRecord(record)) {
      return null;
    }

    const parsed = contract.safeParse(record.data);

    if (!parsed.success) {
      return null;
    }

    shown.set(key, parsed.data);

    return { ...record, data: parsed.data };
  }

  return reatomPersist<unknown, Contract>({
    name: "deviceCache",
    get: read,
    set: async ({ key }, record) => {
      if (shown.get(key) !== record.data) {
        await device?.write(key, record);
      }
    },
  });
}

export function reatomDeviceCache(storage: DeviceStorage | undefined) {
  const device = storage === undefined ? undefined : reatomDeviceStorage(storage);
  const withPersist = reatomCachePersist(device);

  const clear = action(async () => {
    withPersist.storageAtom().cache.clear();
    await wrap(device?.clear());
  }, "deviceCache.clear");

  const keepFor = action(async (owner: CacheOwner) => {
    const recorded = cacheOwner.safeParse(await wrap(device?.read(ownerKey)));

    if (
      recorded.success &&
      recorded.data.memberId === owner.memberId &&
      recorded.data.familyId === owner.familyId
    ) {
      return;
    }

    await wrap(clear());
    await wrap(device?.write(ownerKey, owner));
  }, "deviceCache.keepFor");

  function withDeviceCache<Target extends AtomLike>({
    key,
    schema,
    version,
  }: {
    key: string;
    schema: z.ZodType<AtomState<Target>>;
    version: number;
  }): Ext<Target> {
    return withPersist<Target, AtomState<Target>>({
      key,
      contract: schema,
      version,
      time: keptForMs,
      toSnapshot: (state) => state,
      fromSnapshot: (snapshot) => snapshot,
    });
  }

  return { withDeviceCache, keepFor, clear };
}

export type DeviceCache = ReturnType<typeof reatomDeviceCache>;
