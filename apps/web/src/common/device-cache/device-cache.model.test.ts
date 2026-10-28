import { computed, context, noop, withAsyncData, wrap } from "@reatom/core";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { z } from "zod";

import { fakeDeviceStorage, type FakeDeviceStorage } from "@/common/telegram";

import { reatomDeviceCache, type DeviceCache } from "./device-cache.model.ts";

const chores = ["Погулять с Бьюиком", "Купить корм"];
const denis = { memberId: "member-1", familyId: "family-1" };
const day = 86_400_000;

type ListOptions = { load?: () => Promise<unknown>; version?: number; schema?: z.ZodType };

function cachedList(
  cache: DeviceCache,
  {
    load = async () => new Promise<string[]>(noop),
    version = 1,
    schema = z.array(z.string()),
  }: ListOptions = {},
) {
  const list = computed(async () => wrap(load()), "test.list").extend(withAsyncData());

  list.data.extend(cache.withDeviceCache({ key: "chores", schema, version }));
  list.data.subscribe();

  return list;
}

function launch(device: FakeDeviceStorage, options?: ListOptions) {
  const cache = reatomDeviceCache(device.deviceStorage);

  return { cache, list: cachedList(cache, options) };
}

async function launchLoaded(device: FakeDeviceStorage, data: unknown = chores) {
  const app = launch(device, { load: async () => Promise.resolve(data) });

  await vi.waitFor(() => {
    expect(app.list.data()).toEqual(data);
  });
  await settle();

  return app;
}

function relaunch(device: FakeDeviceStorage, options?: Parameters<typeof launch>[1]) {
  context.reset();

  return launch(device, options);
}

async function settle(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

beforeEach(() => {
  context.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("device cache", () => {
  test("shows the data loaded on the last launch while the new load runs", async () => {
    const device = fakeDeviceStorage();

    await launchLoaded(device);
    const { list } = relaunch(device);

    await vi.waitFor(() => {
      expect(list.data()).toEqual(chores);
    });
  });

  test("keeps the freshly loaded data over the cached one", async () => {
    const device = fakeDeviceStorage();

    await launchLoaded(device);
    const fresh = ["Сварить борщ"];
    const { list } = relaunch(device, { load: async () => Promise.resolve(fresh) });

    await vi.waitFor(() => {
      expect(list.data()).toEqual(fresh);
    });
    await settle();
    expect(list.data()).toEqual(fresh);
  });

  test("drops a cached value that no longer fits the schema", async () => {
    const device = fakeDeviceStorage();

    await launchLoaded(device);
    const { list } = relaunch(device, { schema: z.array(z.number()) });

    await settle();
    expect(list.data()).toBeUndefined();
  });

  test("drops a cached value written by an older version", async () => {
    const device = fakeDeviceStorage();

    await launchLoaded(device);
    const { list } = relaunch(device, { version: 2 });

    await settle();
    expect(list.data()).toBeUndefined();
  });

  test("drops a cached value older than 30 days", async () => {
    const device = fakeDeviceStorage();

    await launchLoaded(device);
    vi.setSystemTime(Date.now() + 31 * day);
    const { list } = relaunch(device);

    await settle();
    expect(list.data()).toBeUndefined();
  });

  test("keeps a 29-day-old cached value", async () => {
    const device = fakeDeviceStorage();

    await launchLoaded(device);
    vi.setSystemTime(Date.now() + 29 * day);
    const { list } = relaunch(device);

    await vi.waitFor(() => {
      expect(list.data()).toEqual(chores);
    });
  });

  test("counts the 30 days from the load, not from the last launch that showed it", async () => {
    const device = fakeDeviceStorage();

    await launchLoaded(device);
    vi.setSystemTime(Date.now() + 20 * day);
    const shown = relaunch(device);

    await vi.waitFor(() => {
      expect(shown.list.data()).toEqual(chores);
    });
    await settle();
    vi.setSystemTime(Date.now() + 11 * day);
    const { list } = relaunch(device);

    await settle();
    expect(list.data()).toBeUndefined();
  });

  test("keeps data in memory only where DeviceStorage is unsupported", async () => {
    const device = fakeDeviceStorage({ isSupported: false });
    const { cache } = await launchLoaded(device);

    expect(cachedList(cache).data()).toEqual(chores);
    const { list } = relaunch(device);

    await settle();
    expect(list.data()).toBeUndefined();
  });

  test("tells when the first screen's keys are read", async () => {
    const device = fakeDeviceStorage();

    await launchLoaded(device);
    context.reset();
    const cache = reatomDeviceCache(device.deviceStorage);
    const list = computed(async () => wrap(new Promise<string[]>(noop)), "test.list").extend(
      withAsyncData(),
    );

    list.data.extend(
      cache.withDeviceCache({ key: "chores", schema: z.array(z.string()), version: 1 }),
    );
    await cache.whenRead([list.data]);

    expect(list.data()).toEqual(chores);
  });

  test("ignores a failed write", async () => {
    const device = fakeDeviceStorage({ isWriteFailing: true });
    const { list } = launch(device, { load: async () => Promise.resolve(chores) });

    await vi.waitFor(() => {
      expect(list.data()).toEqual(chores);
    });
    await settle();
    const relaunched = relaunch(device);

    await settle();
    expect(relaunched.list.data()).toBeUndefined();
  });
});

describe("device cache owner", () => {
  test("keeps the cache for the Member and Family it was written for", async () => {
    const device = fakeDeviceStorage();
    const { cache } = launch(device);

    await cache.keepFor(denis);
    await launchLoaded(device);
    await relaunch(device).cache.keepFor(denis);
    const { list } = relaunch(device);

    await vi.waitFor(() => {
      expect(list.data()).toEqual(chores);
    });
  });

  test("clears the cache for another Member", async () => {
    const device = fakeDeviceStorage();
    const { cache } = launch(device);

    await cache.keepFor(denis);
    await launchLoaded(device);
    await relaunch(device).cache.keepFor({ ...denis, memberId: "member-2" });
    const { list } = relaunch(device);

    await settle();
    expect(list.data()).toBeUndefined();
  });

  test("clears the cache for another Family", async () => {
    const device = fakeDeviceStorage();
    const { cache } = launch(device);

    await cache.keepFor(denis);
    await launchLoaded(device);
    await relaunch(device).cache.keepFor({ ...denis, familyId: "family-2" });
    const { list } = relaunch(device);

    await settle();
    expect(list.data()).toBeUndefined();
  });

  test("clears what it holds in memory where DeviceStorage is unsupported", async () => {
    const device = fakeDeviceStorage({ isSupported: false });
    const { cache } = await launchLoaded(device);

    await cache.clear();
    const list = cachedList(cache);

    await settle();
    expect(list.data()).toBeUndefined();
  });

  test("clears every key on demand", async () => {
    const device = fakeDeviceStorage();
    const { cache } = await launchLoaded(device);

    await cache.clear();
    const { list } = relaunch(device);

    await settle();
    expect(list.data()).toBeUndefined();
  });
});
