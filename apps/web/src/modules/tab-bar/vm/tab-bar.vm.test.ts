import { atom, context } from "@reatom/core";
import { beforeEach, describe, expect, test } from "vite-plus/test";

import type { SlotModule } from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client";

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
  const model = reatomTabBar({
    modules,
    activeTab,
    onOpen: (tab) => {
      opened.push(tab);
    },
    titles: renamed,
  });

  return { model, menu: reatomTabBarMenu({ modules }), activeTab, opened, saves };
}

function titles(tabs: Array<{ title: string }>): string[] {
  return tabs.map((tab) => tab.title);
}

beforeEach(() => {
  context.reset();
});

describe("the tab bar", () => {
  test("puts Планы and Календарь between Сегодня and Разделы until the Member's settings arrive", () => {
    const { model } = startTabBar();

    expect(titles(model.tabs().start)).toEqual(["Сегодня", "Планы"]);
    expect(titles(model.tabs().end)).toEqual(["Календарь", "Разделы"]);
  });

  test("puts the Member's two slots on either side of the microphone", () => {
    const { model } = startTabBar(["recipes", "goals"]);

    expect(titles(model.tabs().start)).toEqual(["Сегодня", "Рецепты"]);
    expect(titles(model.tabs().end)).toEqual(["Цели", "Разделы"]);
  });

  test("marks the tab the open screen belongs to", () => {
    const { model, activeTab } = startTabBar(["plans", "calendar"]);

    activeTab.set("sections");

    expect(model.tabs().end).toEqual([
      { id: "calendar", title: "Календарь", isActive: false },
      { id: "sections", title: "Разделы", isActive: true },
    ]);
  });

  test("names a slot the way its module asks, like the pet tab after the only Pet", () => {
    const { model } = startTabBar(["pet", "plans"], () => ({ pet: "Бьюик" }));

    expect(titles(model.tabs().start)).toEqual(["Сегодня", "Бьюик"]);
  });

  test("opens a tab, the active one included", () => {
    const { model, opened } = startTabBar();

    model.open("today");
    model.open("calendar");

    expect(opened).toEqual(["today", "calendar"]);
  });
});

describe("the slot setup", () => {
  test("puts the picked module in the slot and saves the pair", async () => {
    const { model, menu, saves } = startTabBar(["plans", "calendar"]);

    menu.choose(1, "recipes");

    expect(titles(model.tabs().end)).toEqual(["Рецепты", "Разделы"]);
    await expect.poll(() => saves).toEqual([{ modules: ["plans", "recipes"] }]);
  });

  test("swaps the slots when the module is already in the other one", async () => {
    const { menu, saves } = startTabBar(["plans", "calendar"]);

    menu.choose(0, "calendar");

    await expect.poll(() => saves).toEqual([{ modules: ["calendar", "plans"] }]);
  });

  test("keeps the slots as they are when the module is already in that slot", async () => {
    const { menu, saves } = startTabBar(["plans", "calendar"]);

    menu.choose(1, "calendar");
    await Promise.resolve();

    expect(saves).toEqual([]);
  });
});
