import { describe, expect, test } from "vite-plus/test";

import { eventChange } from "./event.ts";

function change(end: { date: string; time: string | null }) {
  return {
    title: "Ужин с Асей",
    note: null,
    start: { date: "2026-10-22", time: "19:00", timeZone: "Europe/Moscow" },
    end,
    recurrence: null,
    visibility: "shared",
  };
}

describe("an Event change", () => {
  test.each([
    ["later the same day", { date: "2026-10-22", time: "21:00" }],
    ["on a later day before the start's time", { date: "2026-10-23", time: "08:00" }],
  ])("accepts an end %s", (_case, end) => {
    expect(eventChange.safeParse(change(end)).success).toBe(true);
  });

  test.each([
    ["earlier the same day", { date: "2026-10-22", time: "18:00" }],
    ["on an earlier day", { date: "2026-10-21", time: "21:00" }],
  ])("refuses an end %s", (_case, end) => {
    expect(eventChange.safeParse(change(end)).success).toBe(false);
  });
});
