import { describe, expect, test } from "vite-plus/test";

import { dueStepFrom, eventReminderMoment, morningOf, planReminderMoment } from "./fire-time.ts";

function iso(moment: number) {
  return new Date(moment).toISOString();
}

describe("a floating date's morning", () => {
  test.each([
    ["Europe/Moscow", "2026-10-20T06:00:00.000Z"],
    ["Asia/Vladivostok", "2026-10-19T23:00:00.000Z"],
    ["America/New_York", "2026-10-20T13:00:00.000Z"],
  ])("is 09:00 on the Recipient's own clock in %s", (zone, moment) => {
    expect(iso(morningOf("2026-10-20", zone))).toBe(moment);
  });
});

describe("an Event Reminder", () => {
  const timed = { date: "2026-10-22", time: "19:00", timeZone: "Europe/Moscow" };
  const allDay = { date: "2026-10-22", time: null, timeZone: null };

  test.each([
    ["at-start", "2026-10-22T16:00:00.000Z"],
    ["15m", "2026-10-22T15:45:00.000Z"],
    ["1h", "2026-10-22T15:00:00.000Z"],
    ["1d", "2026-10-21T16:00:00.000Z"],
    ["1w", "2026-10-15T16:00:00.000Z"],
  ] as const)("of a timed Event comes %s before its start", (offset, moment) => {
    const fire = eventReminderMoment("2026-10-22", {
      start: timed,
      offset,
      recipientZone: "Asia/Vladivostok",
    });

    expect(iso(fire)).toBe(moment);
  });

  test.each([
    ["at-start", "2026-10-22T06:00:00.000Z"],
    ["1h", "2026-10-22T06:00:00.000Z"],
    ["1d", "2026-10-21T06:00:00.000Z"],
    ["1w", "2026-10-15T06:00:00.000Z"],
  ] as const)("of an all-day Event comes at 09:00 for %s", (offset, moment) => {
    const fire = eventReminderMoment("2026-10-22", {
      start: allDay,
      offset,
      recipientZone: "Europe/Moscow",
    });

    expect(iso(fire)).toBe(moment);
  });
});

describe("the Due Date nudges", () => {
  test.each([
    ["long before", "2026-09-01", "2026-10-13"],
    ["on the week-ahead day", "2026-10-13", "2026-10-13"],
    ["between the week ahead and the day", "2026-10-14", "2026-10-20"],
    ["on the day", "2026-10-20", "2026-10-20"],
    ["the day after", "2026-10-21", "2026-10-27"],
    ["a week late", "2026-10-27", "2026-10-27"],
    ["a month late", "2026-11-18", "2026-11-24"],
  ])("from %s fall on the next step", (_case, day, step) => {
    expect(dueStepFrom("2026-10-20", day)).toBe(step);
  });
});

describe("a Plan's deadline Reminder", () => {
  test.each([
    ["on-day", "2026-10-22T06:00:00.000Z"],
    ["1d", "2026-10-21T06:00:00.000Z"],
    ["1w", "2026-10-15T06:00:00.000Z"],
  ] as const)("comes %s before the due day at 09:00 on the Recipient's clock", (lead, moment) => {
    expect(iso(planReminderMoment("2026-10-22", { lead, recipientZone: "Europe/Moscow" }))).toBe(
      moment,
    );
  });
});
