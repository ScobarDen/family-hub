import { context } from "@reatom/core";
import { beforeEach, describe, expect, test } from "vite-plus/test";

import { loaded, startTasks } from "./tasks.fixtures.ts";

beforeEach(() => {
  context.reset();
});

describe("the calendar", () => {
  test("lists a day's Tasks beside a Pet's birthday and opens the Pet from it", async () => {
    const { model, openedPets } = startTasks();

    await loaded(model);
    model.showView("calendar");

    expect(model.screen()).toEqual({ kind: "calendar" });

    model.select("2026-10-20");

    expect(model.dayRows().map(({ item }) => item.title)).toEqual([
      "Ремонт",
      "День рождения: Бьюик, 4 года",
    ]);

    const birthday = model.dayRows().find(({ item }) => item.kind === "birthday");

    if (birthday === undefined) {
      throw new Error("No birthday on 20 October");
    }

    model.openItem(birthday.item);

    expect(openedPets).toEqual(["pet-1"]);
  });

  test("remembers the list or the calendar for the next opening", () => {
    const first = startTasks();

    expect(first.model.view()).toBe("list");

    first.model.showView("calendar");

    const second = startTasks();

    expect(second.model.view()).toBe("calendar");
  });
});
