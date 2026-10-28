import { atom, context } from "@reatom/core";
import { beforeEach, describe, expect, test } from "vite-plus/test";

import type { SlotModule } from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client";
import { fakeHaptics } from "@/common/telegram";

import { createTabBarApi } from "../tab-bar.api.ts";
import { reatomTabBarModules } from "../tab-bar.model.ts";
import { reatomTabBarMenu } from "./tab-bar-menu.vm.ts";
import { reatomTabBar, type TabId } from "./tab-bar.vm.ts";

function startTabBar(saved?: SlotModule[], renamed?: () => Partial<Record<SlotModule, string>>) {
  const saves: unknown[] = [];
  const client = createHttpClient({
    baseUrl: "https://api.family-hub.test",
    fetch: async (_input, init) => {
      const body: unknown = JSON.parse(typeof init?.body === "string" ? init.body : "null");

      saves.push(body);

      return Response.json(body);
    },
  });
  const activeTab = atom<TabId>("today", "test.activeTab");
  const opened: TabId[] = [];
  const modules = reatomTabBarModules({ api: createTabBarApi(client), saved: () => saved });
  const haptics = fakeHaptics();
  const model = reatomTabBar({
    modules,
    activeTab,
    onOpen: (tab) => {
      opened.push(tab);
    },
    telegram: { haptics },
    titles: renamed,
  });

  return {
    model,
    menu: reatomTabBarMenu({ modules, telegram: { haptics } }),
    activeTab,
    opened,
    saves,
    felt: haptics.felt,
  };
}

function titles(tabs: Array<{ title: string }>): string[] {
  return tabs.map((tab) => tab.title);
}

beforeEach(() => {
  context.reset();
});

describe("the tab bar", () => {
  test("puts Дела and Питомцы between Сегодня and Разделы until the Member's settings arrive", () => {
    const { model } = startTabBar();

    expect(titles(model.tabs().start)).toEqual(["Сегодня", "Дела"]);
    expect(titles(model.tabs().end)).toEqual(["Питомцы", "Разделы"]);
  });

  test("puts the Member's two slots on either side of the microphone", () => {
    const { model } = startTabBar(["recipes", "goals"]);

    expect(titles(model.tabs().start)).toEqual(["Сегодня", "Рецепты"]);
    expect(titles(model.tabs().end)).toEqual(["Цели", "Разделы"]);
  });

  test("marks the tab the open screen belongs to", () => {
    const { model, activeTab } = startTabBar(["tasks", "goals"]);

    activeTab.set("sections");

    expect(model.tabs().end).toEqual([
      { id: "goals", title: "Цели", isActive: false },
      { id: "sections", title: "Разделы", isActive: true },
    ]);
  });

  test("names a slot the way its module asks, like the pet tab after the only Pet", () => {
    const { model } = startTabBar(["pet", "tasks"], () => ({ pet: "Бьюик" }));

    expect(titles(model.tabs().start)).toEqual(["Сегодня", "Бьюик"]);
  });

  test("opens a tab, the active one included, ticking only on a switch", () => {
    const { model, opened, felt } = startTabBar();

    model.open("today");
    model.open("goals");

    expect(opened).toEqual(["today", "goals"]);
    expect(felt).toEqual(["select"]);
  });
});

describe("the slot setup", () => {
  test("puts the picked module in the slot and saves the pair", async () => {
    const { model, menu, saves } = startTabBar(["tasks", "goals"]);

    menu.choose(1, "recipes");

    expect(titles(model.tabs().end)).toEqual(["Рецепты", "Разделы"]);
    await expect.poll(() => saves).toEqual([{ modules: ["tasks", "recipes"] }]);
  });

  test("swaps the slots when the module is already in the other one", async () => {
    const { menu, saves } = startTabBar(["tasks", "goals"]);

    menu.choose(0, "goals");

    await expect.poll(() => saves).toEqual([{ modules: ["goals", "tasks"] }]);
  });

  test("keeps the slots as they are when the module is already in that slot", async () => {
    const { menu, saves } = startTabBar(["tasks", "goals"]);

    menu.choose(1, "goals");
    await Promise.resolve();

    expect(saves).toEqual([]);
  });
});
