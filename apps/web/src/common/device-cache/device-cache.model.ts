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
  const reads = new Set<Promise<unknown>>();

  async function read({
    key,
    contract,
  }: { key: string } & Contract): Promise<PersistRecord | null> {
    const reading = device?.read(key);

    if (reading !== undefined) {
      reads.add(reading);
    }

    const record = await reading;

    if (reading !== undefined) {
      reads.delete(reading);
    }

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

  const withPersist = reatomPersist<unknown, Contract>({
    name: "deviceCache",
    get: read,
    set: async ({ key }, record) => {
      if (record.data !== undefined && shown.get(key) !== record.data) {
        await device?.write(key, record);
      }
    },
  });

  return { withPersist, reads };
}

// Reading an atom starts its key's read; Reatom applies the value a few promise turns later.
function reatomWhenRead(reads: ReadonlySet<Promise<unknown>>) {
  return action(async (atoms: Array<() => unknown>) => {
    for (const read of atoms) {
      read();
    }

    await wrap(Promise.all(reads));
    await wrap(
      new Promise((resolve) => {
        setTimeout(resolve, 0);
      }),
    );
  }, "deviceCache.whenRead");
}

function reatomWithDeviceCache(withPersist: ReturnType<typeof reatomCachePersist>["withPersist"]) {
  return function withDeviceCache<Target extends AtomLike>({
    key,
    schema,
    version,
    cachedPart = (state) => state,
  }: {
    key: string;
    schema: z.ZodType<AtomState<Target>>;
    version: number;
    // undefined leaves the copy already on the device.
    cachedPart?: (state: AtomState<Target>) => AtomState<Target> | undefined;
  }): Ext<Target> {
    return withPersist<Target, AtomState<Target> | undefined>({
      key,
      contract: schema,
      version,
      time: keptForMs,
      toSnapshot: cachedPart,
    });
  };
}

export function reatomDeviceCache(storage: DeviceStorage | undefined) {
  const device = storage === undefined ? undefined : reatomDeviceStorage(storage);
  const { withPersist, reads } = reatomCachePersist(device);

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

  return {
    withDeviceCache: reatomWithDeviceCache(withPersist),
    keepFor,
    clear,
    whenRead: reatomWhenRead(reads),
  };
}

export type DeviceCache = ReturnType<typeof reatomDeviceCache>;
