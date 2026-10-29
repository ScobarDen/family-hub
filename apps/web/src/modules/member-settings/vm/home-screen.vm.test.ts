import { context } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { z } from "zod";

import { reatomDeviceCache } from "@/modules/device-cache";
import {
  fakeDeviceStorage,
  fakeWindow,
  type FakeDeviceStorage,
  type HomeScreenStatus,
} from "@/modules/telegram";

import { reatomHomeScreen } from "./home-screen.vm.ts";

function storedIn<Value>(device: FakeDeviceStorage, key: string, schema: z.ZodType<Value>) {
  return z.object({ data: schema }).safeParse(JSON.parse(device.items.get(key) ?? "{}")).data?.data;
}

async function launch(
  device: FakeDeviceStorage,
  { status = "missed" }: { status?: HomeScreenStatus } = {},
) {
  context.reset();
  const telegram = fakeWindow({ homeScreenStatus: status });
  const model = reatomHomeScreen({
    telegram,
    deviceCache: reatomDeviceCache(device.deviceStorage),
  });

  const launched = (storedIn(device, "home-screen.launches", z.number()) ?? 0) + 1;
  const wasOffered = storedIn(device, "home-screen.offered", z.boolean()) ?? false;

  await model.countLaunch();
  const offers = telegram.calls.filter((call) => call === "addToHomeScreen");

  await vi.waitFor(() => {
    expect(storedIn(device, "home-screen.launches", z.number())).toBe(launched);
    expect(storedIn(device, "home-screen.offered", z.boolean()) ?? false).toBe(
      wasOffered || offers.length > 0,
    );
  });

  return { model, offers };
}

async function launchTimes(device: FakeDeviceStorage, times: number) {
  const offered: number[] = [];

  for (let launchNumber = 1; launchNumber <= times; launchNumber += 1) {
    const { offers } = await launch(device);

    if (offers.length > 0) {
      offered.push(launchNumber);
    }
  }

  return offered;
}

beforeEach(() => {
  context.reset();
});

describe("the Add to Home Screen offer", () => {
  test("comes once, on the fifth launch", async () => {
    const device = fakeDeviceStorage();

    expect(await launchTimes(device, 7)).toEqual([5]);
  });

  test("stays away on the fifth launch when the app is already there", async () => {
    const device = fakeDeviceStorage();

    await launchTimes(device, 4);
    const { offers } = await launch(device, { status: "added" });

    expect(offers).toEqual([]);
  });

  test("comes on a later launch when the app was not missing on the fifth", async () => {
    const device = fakeDeviceStorage();

    await launchTimes(device, 4);
    await launch(device, { status: "unsupported" });
    const sixth = await launch(device);
    const seventh = await launch(device);

    expect([sixth.offers, seventh.offers]).toEqual([["addToHomeScreen"], []]);
  });
});

describe("the Profile entry", () => {
  test("offers to add the app while it is missing", async () => {
    const { model } = await launch(fakeDeviceStorage());

    expect(model.entry()).toEqual({ isAdded: false });
  });

  test("says the app is there once it is added", async () => {
    const { model } = await launch(fakeDeviceStorage(), { status: "added" });

    expect(model.entry()).toEqual({ isAdded: true });
  });

  test("is hidden where Telegram cannot add the app", async () => {
    const { model } = await launch(fakeDeviceStorage(), { status: "unsupported" });

    expect(model.entry()).toBeUndefined();
  });

  test("asks Telegram to add the app", async () => {
    const telegram = fakeWindow();
    const model = reatomHomeScreen({
      telegram,
      deviceCache: reatomDeviceCache(fakeDeviceStorage().deviceStorage),
    });

    model.add();

    expect(telegram.calls).toEqual(["addToHomeScreen"]);
  });
});
