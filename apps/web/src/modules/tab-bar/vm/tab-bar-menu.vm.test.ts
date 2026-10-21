import { context } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { tabBarSettings, type AppModule, type TabBarSettings } from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client";

import { createTabBarApi } from "../tab-bar.api.ts";
import { reatomTabBarModules } from "../tab-bar.model.ts";
import { reatomTabBarMenu } from "./tab-bar-menu.vm.ts";

function fakeBackend({ isDown = false } = {}) {
  const saved: AppModule[][] = [];

  async function fetch(_url: URL, init: RequestInit): Promise<Response> {
    if (isDown) {
      throw new TypeError("Failed to fetch");
    }

    const body = tabBarSettings.parse(JSON.parse(typeof init.body === "string" ? init.body : ""));

    saved.push(body.modules);

    return Response.json(body satisfies TabBarSettings);
  }

  return { fetch, saved };
}

function startMenu(saved: AppModule[], backend = fakeBackend()) {
  const client = createHttpClient({ baseUrl: "https://api.family-hub.test", fetch: backend.fetch });

  return reatomTabBarMenu({
    modules: reatomTabBarModules({ api: createTabBarApi(client), saved: () => saved }),
  });
}

function enabled(model: ReturnType<typeof startMenu>): AppModule[] {
  return model
    .items()
    .filter((item) => item.isEnabled)
    .map((item) => item.module);
}

function itemOf(model: ReturnType<typeof startMenu>, module: AppModule) {
  return model.items().find((candidate) => candidate.module === module);
}

async function settled(model: ReturnType<typeof startMenu>) {
  await vi.waitFor(() => {
    expect(model.isSaving()).toBe(false);
  });
}

beforeEach(() => {
  context.reset();
});

describe("the «Нижнее меню» screen", () => {
  test("lists the tab bar's modules in order, then the hidden ones", () => {
    const model = startMenu(["calendar", "feed"]);

    expect(model.items().map(({ title, isEnabled }) => [title, isEnabled])).toEqual([
      ["Календарь", true],
      ["Лента", true],
      ["Планы", false],
      ["Питомец", false],
      ["Цели", false],
      ["Альбомы", false],
      ["Рецепты", false],
    ]);
  });

  test("adds a module to the end of the tab bar and saves it", async () => {
    const backend = fakeBackend();
    const model = startMenu(["feed", "plans"], backend);

    model.toggle("goals");

    expect(enabled(model)).toEqual(["feed", "plans", "goals"]);
    await settled(model);
    expect(backend.saved).toEqual([["feed", "plans", "goals"]]);
  });

  test("removes a module from the tab bar", async () => {
    const backend = fakeBackend();
    const model = startMenu(["feed", "plans", "calendar"], backend);

    model.toggle("plans");
    await settled(model);

    expect(enabled(model)).toEqual(["feed", "calendar"]);
    expect(backend.saved).toEqual([["feed", "calendar"]]);
  });

  test("keeps at least two modules", () => {
    const model = startMenu(["feed", "plans"]);

    model.toggle("feed");

    expect(itemOf(model, "feed")?.canToggle).toBe(false);
    expect(enabled(model)).toEqual(["feed", "plans"]);
  });

  test("allows at most five modules", () => {
    const model = startMenu(["feed", "plans", "calendar", "pet", "goals"]);

    model.toggle("albums");

    expect(itemOf(model, "albums")?.canToggle).toBe(false);
    expect(itemOf(model, "goals")?.canToggle).toBe(true);
    expect(enabled(model)).toHaveLength(5);
  });

  test("moves a module up and down the tab bar", async () => {
    const backend = fakeBackend();
    const model = startMenu(["feed", "plans", "calendar"], backend);

    model.moveUp("calendar");
    await settled(model);
    model.moveDown("feed");
    await settled(model);

    expect(enabled(model)).toEqual(["calendar", "feed", "plans"]);
    expect(backend.saved).toEqual([
      ["feed", "calendar", "plans"],
      ["calendar", "feed", "plans"],
    ]);
  });

  test("moves only within the tab bar", () => {
    const model = startMenu(["feed", "plans"]);

    expect(itemOf(model, "feed")).toMatchObject({ canMoveUp: false, canMoveDown: true });
    expect(itemOf(model, "plans")).toMatchObject({ canMoveUp: true, canMoveDown: false });
    expect(itemOf(model, "goals")).toMatchObject({ canMoveUp: false, canMoveDown: false });
  });

  test("puts the tab bar back when saving fails", async () => {
    const model = startMenu(["feed", "plans"], fakeBackend({ isDown: true }));

    model.toggle("goals");
    await settled(model);

    expect(enabled(model)).toEqual(["feed", "plans"]);
    expect(model.failure()).toBe("Не получилось сохранить нижнее меню. Попробуйте ещё раз.");
  });
});
