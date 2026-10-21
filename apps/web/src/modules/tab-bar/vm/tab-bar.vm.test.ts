import { atom, context } from "@reatom/core";
import { beforeEach, describe, expect, test } from "vite-plus/test";

import type { AppModule } from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client";

import { createTabBarApi } from "../tab-bar.api.ts";
import { reatomTabBarModules } from "../tab-bar.model.ts";
import { reatomTabBar } from "./tab-bar.vm.ts";

function startTabBar(saved?: AppModule[], renamed?: () => Partial<Record<AppModule, string>>) {
  const client = createHttpClient({
    baseUrl: "https://api.family-hub.test",
    fetch: async () => Response.json({}),
  });
  const activeModule = atom<AppModule | undefined>(undefined, "test.activeModule");
  const opened: AppModule[] = [];
  const model = reatomTabBar({
    modules: reatomTabBarModules({ api: createTabBarApi(client), saved: () => saved }),
    activeModule,
    onOpen: (module) => {
      opened.push(module);
    },
    titles: renamed,
  });

  return { model, activeModule, opened };
}

function titles(tabs: Array<{ title: string }>): string[] {
  return tabs.map((tab) => tab.title);
}

beforeEach(() => {
  context.reset();
});

describe("the tab bar", () => {
  test("shows Лента · Планы · Календарь · Питомец until the Member's settings arrive", () => {
    const { model } = startTabBar();

    expect(titles([...model.tabs().start, ...model.tabs().end])).toEqual([
      "Лента",
      "Планы",
      "Календарь",
      "Питомец",
    ]);
  });

  test("shows the Member's modules in their order, split evenly around the centre", () => {
    const { model } = startTabBar(["goals", "feed", "albums", "plans"]);

    expect(titles(model.tabs().start)).toEqual(["Цели", "Лента"]);
    expect(titles(model.tabs().end)).toEqual(["Альбомы", "Планы"]);
  });

  test("puts the odd tab on the left of the centre", () => {
    const { model } = startTabBar(["feed", "plans", "calendar"]);

    expect(titles(model.tabs().start)).toEqual(["Лента", "Планы"]);
    expect(titles(model.tabs().end)).toEqual(["Календарь"]);
  });

  test("marks the open module's tab", () => {
    const { model, activeModule } = startTabBar(["feed", "plans"]);

    activeModule.set("plans");

    expect(model.tabs()).toEqual({
      start: [{ module: "feed", title: "Лента", isActive: false }],
      end: [{ module: "plans", title: "Планы", isActive: true }],
    });
  });

  test("names a tab the way its module asks, like the pet tab after the only Pet", () => {
    const { model } = startTabBar(["feed", "pet"], () => ({ pet: "Бьюик" }));

    expect(titles(model.tabs().end)).toEqual(["Бьюик"]);
  });

  test("opens a module from its tab", () => {
    const { model, opened } = startTabBar(["feed", "plans"]);

    model.open("plans");

    expect(opened).toEqual(["plans"]);
  });
});

describe("the modules hidden from the tab bar", () => {
  test("are offered in the Profile in the catalogue order", () => {
    const { model } = startTabBar(["albums", "feed", "plans"]);

    expect(model.hidden()).toEqual([
      { module: "calendar", title: "Календарь" },
      { module: "pet", title: "Питомец" },
      { module: "goals", title: "Цели" },
      { module: "recipes", title: "Рецепты" },
    ]);
  });

  test("leave out every module the tab bar shows", () => {
    const { model } = startTabBar(["feed", "plans", "calendar", "pet", "goals"]);

    expect(model.hidden()).toEqual([
      { module: "albums", title: "Альбомы" },
      { module: "recipes", title: "Рецепты" },
    ]);
  });
});
