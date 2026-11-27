import { atom, context } from "@reatom/core";
import { beforeEach, describe, expect, test } from "vite-plus/test";

import type { AppModule, SlotModule } from "@family-hub/contract";

import { fakeHaptics } from "@/modules/telegram";

import { reatomSidebar, type SidebarItemId } from "./sidebar.vm.ts";

function startSidebar(slots: SlotModule[], renamed?: () => Partial<Record<AppModule, string>>) {
  const activeTab = atom<string>("today", "test.activeTab");
  const opened: SidebarItemId[] = [];
  const haptics = fakeHaptics();
  let adds = 0;
  const model = reatomSidebar({
    slots: () => slots,
    activeTab,
    onOpen: (item) => {
      opened.push(item);
    },
    onAdd: () => {
      adds += 1;
    },
    telegram: { haptics },
    titles: renamed,
  });

  return { model, activeTab, opened, felt: haptics.felt, adds: () => adds };
}

function titles(items: Array<{ title: string }>): string[] {
  return items.map((item) => item.title);
}

beforeEach(() => {
  context.reset();
});

describe("the sidebar", () => {
  test("lists Сегодня, then every module in the «Разделы» order, and the Profile apart", () => {
    const { model } = startSidebar(["recipes", "goals"]);

    expect(titles(model.items())).toEqual([
      "Сегодня",
      "Рецепты",
      "Цели",
      "Лента",
      "Дела",
      "Питомцы",
      "Альбомы",
    ]);
    expect(model.profile().title).toBe("Профиль");
  });

  test("marks the item the open screen belongs to", () => {
    const { model, activeTab } = startSidebar(["tasks", "pet"]);

    activeTab.set("albums");

    expect(model.items().filter((item) => item.isActive)).toEqual([
      { id: "albums", title: "Альбомы", isActive: true },
    ]);
    expect(model.profile().isActive).toBe(false);

    activeTab.set("profile");

    expect(model.items().some((item) => item.isActive)).toBe(false);
    expect(model.profile().isActive).toBe(true);
  });

  test("names a module the way it asks, like the Pets after the only Pet", () => {
    const { model } = startSidebar(["pet", "tasks"], () => ({ pet: "Бьюик" }));

    expect(titles(model.items()).slice(0, 2)).toEqual(["Сегодня", "Бьюик"]);
  });

  test("opens an item, the active one included, ticking only on a switch", () => {
    const { model, opened, felt } = startSidebar(["tasks", "pet"]);

    model.open("today");
    model.open("profile");

    expect(opened).toEqual(["today", "profile"]);
    expect(felt).toEqual(["select"]);
  });

  test("opens the quick-add from «Добавить»", () => {
    const { model, adds } = startSidebar(["tasks", "pet"]);

    model.add();

    expect(adds()).toBe(1);
  });
});
