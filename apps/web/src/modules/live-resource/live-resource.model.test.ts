import { atom, context, noop, sleep } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { z } from "zod";

import { rolledBack } from "@/common/records.lib.ts";
import { reatomOptimistic, reatomRollbackFailure } from "@/modules/changes";
import { reatomDeviceCache } from "@/modules/device-cache";
import { fakeDeviceStorage, fakeHaptics, type FakeDeviceStorage } from "@/modules/telegram";

import { reatomLiveResource, type LiveResourceOptions } from "./live-resource.model.ts";

const chores = ["Погулять с Бьюиком", "Купить корм"];

function startChores(
  load: () => Promise<string[]> = async () => chores,
  options: Partial<Pick<LiveResourceOptions<string[]>, "cache" | "rollback">> = {},
) {
  const liveVersion = atom(0, "test.liveVersion");
  const loads: string[][] = [];
  const resource = reatomLiveResource({
    name: "test.chores",
    liveVersion,
    load: async () => {
      const loaded = await load();

      loads.push(loaded);

      return loaded;
    },
    ...options,
  });

  resource.status.subscribe(noop);

  return { resource, liveVersion, loads };
}

function startCachedChores(device: FakeDeviceStorage, load: () => Promise<string[]>) {
  const { withDeviceCache } = reatomDeviceCache(device.deviceStorage);

  return startChores(load, {
    cache: { withDeviceCache, key: "chores", schema: z.array(z.string()), version: 1 },
  });
}

beforeEach(() => {
  context.reset();
});

describe("a live resource", () => {
  test("is loading until its first answer and ready with it", async () => {
    const { resource } = startChores();

    expect(resource.status()).toBe("loading");
    await vi.waitFor(() => {
      expect(resource.status()).toBe("ready");
    });
    expect(resource.data()).toEqual(chores);
  });

  test("loads again when its live version moves", async () => {
    const { resource, liveVersion, loads } = startChores();

    await vi.waitFor(() => {
      expect(loads).toHaveLength(1);
    });
    liveVersion.set(1);

    await vi.waitFor(() => {
      expect(loads).toHaveLength(2);
    });
    expect(resource.status()).toBe("ready");
  });

  test("has failed when the load fails with nothing to show", async () => {
    const { resource } = startChores(async () => Promise.reject(new TypeError("Failed to fetch")));

    await vi.waitFor(() => {
      expect(resource.status()).toBe("failed");
    });
    expect(resource.data()).toBeUndefined();
  });

  test("keeps what it shows, marked stale, when a refresh fails", async () => {
    let isDown = false;
    const { resource, liveVersion } = startChores(async () =>
      isDown ? Promise.reject(new TypeError("Failed to fetch")) : chores,
    );

    await vi.waitFor(() => {
      expect(resource.status()).toBe("ready");
    });
    isDown = true;
    liveVersion.set(1);
    await vi.waitFor(() => {
      expect(resource.status()).toBe("stale");
    });
    expect(resource.data()).toEqual(chores);
  });

  test("shows a local change at once, and a fetch sent before it does not undo it", async () => {
    let saved = chores;
    let release = noop;
    const { resource, liveVersion } = startChores(async () => {
      const answer = saved;

      await new Promise<void>((resolve) => {
        release = resolve;
      });

      return answer;
    });

    release();
    await vi.waitFor(() => {
      expect(resource.status()).toBe("ready");
    });
    liveVersion.set(1);
    await sleep(0);
    const stale = release;

    saved = [...chores, "Помыть лапы"];
    resource.change((current) => [...(current ?? []), "Помыть лапы"]);

    expect(resource.data()).toEqual(saved);

    stale();
    await sleep(0);
    release();

    await vi.waitFor(() => {
      expect(resource.data()).toEqual(saved);
    });
    await sleep(0);
    expect(resource.data()).toEqual(saved);
  });

  test("shows what the device kept from the last launch while the new load runs", async () => {
    const device = fakeDeviceStorage();

    startCachedChores(device, async () => chores);

    await vi.waitFor(() => {
      expect(device.items.get("chores")).toBeDefined();
    });
    context.reset();
    const { resource } = startCachedChores(device, async () => new Promise<string[]>(noop));

    await vi.waitFor(() => {
      expect(resource.data()).toEqual(chores);
    });
    expect(resource.status()).toBe("ready");
  });

  test("returns to what it showed when the server refuses a change", async () => {
    const { resource } = startChores(async () => chores, { rollback: "whole" });
    const failure = reatomRollbackFailure("test.failure", fakeHaptics());
    const addChore = reatomOptimistic(
      async (chore: string) => {
        resource.change((current) => [...(current ?? []), chore]);
        await Promise.reject(new TypeError("Failed to fetch"));
      },
      { name: "test.addChore", failure, refusal: "Не получилось" },
    );

    await vi.waitFor(() => {
      expect(resource.status()).toBe("ready");
    });
    await addChore("Помыть лапы").catch(noop);

    expect(resource.data()).toEqual(chores);
  });

  test("rolls back only what the refused change touched", async () => {
    const { resource } = startChores(async () => chores, {
      rollback: (states) => rolledBack(states, (chore) => chore),
    });
    const failure = reatomRollbackFailure("test.failure", fakeHaptics());
    let refuse = noop;
    const addChore = reatomOptimistic(
      async (chore: string) => {
        resource.change((current) => [...(current ?? []), chore]);
        await new Promise<void>((_resolve, reject) => {
          refuse = () => {
            reject(new TypeError("Failed to fetch"));
          };
        });
      },
      { name: "test.addChore", failure, refusal: "Не получилось" },
    );

    await vi.waitFor(() => {
      expect(resource.status()).toBe("ready");
    });
    const adding = addChore("Помыть лапы").catch(noop);

    resource.change((current) => [...(current ?? []), "Сварить борщ"]);
    refuse();
    await adding;

    expect(resource.data()).toEqual([...chores, "Сварить борщ"]);
  });
});
