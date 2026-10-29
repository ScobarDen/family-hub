import { context } from "@reatom/core";
import { beforeEach, describe, expect, test } from "vite-plus/test";

import { fakeWindow, type HomeScreenStatus } from "@/modules/telegram";

import { reatomHomeScreen } from "./home-screen.vm.ts";

async function launch({ status = "missed" }: { status?: HomeScreenStatus } = {}) {
  const telegram = fakeWindow({ homeScreenStatus: status });
  const model = reatomHomeScreen({ telegram });

  await model.load();

  return { model, telegram };
}

beforeEach(() => {
  context.reset();
});

describe("the Telegram shortcut", () => {
  test("never offers itself at launch", async () => {
    const { telegram } = await launch();

    expect(telegram.calls).not.toContain("addToHomeScreen");
  });

  test("offers to add the shortcut from the Profile while it is missing", async () => {
    const { model } = await launch();

    expect(model.entry()).toEqual({ isAdded: false });
  });

  test("says the shortcut is there once it is added", async () => {
    const { model } = await launch({ status: "added" });

    expect(model.entry()).toEqual({ isAdded: true });
  });

  test("is hidden where Telegram cannot add it", async () => {
    const { model } = await launch({ status: "unsupported" });

    expect(model.entry()).toBeUndefined();
  });

  test("asks Telegram to add it", async () => {
    const { model, telegram } = await launch();

    model.add();

    expect(telegram.calls).toContain("addToHomeScreen");
  });
});
