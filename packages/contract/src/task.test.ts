import { describe, expect, test } from "vite-plus/test";

import { taskChange } from "./task.ts";

const dated = { date: "2026-10-27", time: null, timeZone: null, endDate: null, endTime: null };
const timed = { ...dated, time: "15:00", timeZone: "Europe/Moscow" };

describe("a Task change", () => {
  test("needs only a title", () => {
    expect(taskChange.safeParse({ title: "Купить пылесос" }).success).toBe(true);
  });

  test.each([
    ["a Recurrence", { recurrence: { frequency: "weekly", until: null } }],
    ["a Reminder", { reminderOffsets: ["at-start"] }],
  ])("refuses %s without a date", (_case, extra) => {
    expect(taskChange.safeParse({ title: "Таблетка Бьюику", ...extra }).success).toBe(false);
  });

  test("offers minutes and hours before only to a timed Task", () => {
    expect(
      taskChange.safeParse({ title: "Стоматолог", when: dated, reminderOffsets: ["1h"] }).success,
    ).toBe(false);
    expect(
      taskChange.safeParse({ title: "Стоматолог", when: timed, reminderOffsets: ["1h", "1d"] })
        .success,
    ).toBe(true);
  });

  test("refuses more than three Reminders", () => {
    expect(
      taskChange.safeParse({
        title: "Стоматолог",
        when: timed,
        reminderOffsets: ["at-start", "15m", "1h", "1d"],
      }).success,
    ).toBe(false);
  });

  test("refuses an end before the start", () => {
    expect(
      taskChange.safeParse({ title: "Отпуск", when: { ...dated, endDate: "2026-10-26" } }).success,
    ).toBe(false);
  });
});
