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

  test("ticks on switching to it and on picking a day, not on moving around", async () => {
    const { model, felt } = startTasks();

    await loaded(model);
    model.showView("calendar");
    model.select("2026-10-20");

    const [row] = model.dayRows();

    if (row === undefined) {
      throw new Error("No Tasks on 20 October");
    }

    model.openItem(row.item);
    model.nextMonth();

    expect(felt).toEqual(["select", "select"]);
  });

  test("names each day aloud with its weekday, month and whether anything is on it", async () => {
    const { model } = startTasks();

    await loaded(model);
    model.showView("calendar");

    const labels = new Map(model.grid().map(({ date, label }) => [date, label]));

    expect(labels.get("2026-10-20")).toBe("вторник, 20 октября, есть дела");
    expect(labels.get("2026-10-21")).toBe("среда, 21 октября");
    expect(labels.get("2026-11-01")).toBe("воскресенье, 1 ноября");
  });

  test("remembers the list or the calendar for the next opening", () => {
    const first = startTasks();

    expect(first.model.view()).toBe("list");

    first.model.showView("calendar");

    const second = startTasks();

    expect(second.model.view()).toBe("calendar");
  });
});
