import { describe, expect, test } from "vite-plus/test";

import { dueStepFrom, eventReminderMoment, morningOf, planReminderMoment } from "./fire-time.ts";
import { dateInZone, timeInZone } from "./occurrence.ts";

function iso(moment: number) {
  return new Date(moment).toISOString();
}

const berlin = "Europe/Berlin";

function inBerlin(moment: number) {
  return `${dateInZone(moment, berlin)}T${timeInZone(moment, berlin)}`;
}

describe("a floating date's morning", () => {
  test.each(["2026-03-29", "2026-10-25"])("is 09:00 on a DST change day %s", (date) => {
    expect(inBerlin(morningOf(date, berlin))).toBe(`${date}T09:00`);
  });

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
    ["2026-03-29", "1d", "2026-03-28T19:00"],
    ["2026-03-29", "1w", "2026-03-22T19:00"],
    ["2026-10-25", "1d", "2026-10-24T19:00"],
    ["2026-10-25", "1w", "2026-10-18T19:00"],
  ] as const)(
    "of a timed Event on %s keeps its wall-clock time %s before across a DST change",
    (date, offset, local) => {
      const fire = eventReminderMoment(date, {
        start: { date, time: "19:00", timeZone: berlin },
        offset,
        recipientZone: berlin,
      });

      expect(inBerlin(fire)).toBe(local);
    },
  );

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
  test.each(["2026-03-29", "2026-10-25"])("comes at 09:00 on a DST change day %s", (date) => {
    const fire = planReminderMoment(date, { lead: "on-day", recipientZone: berlin });

    expect(inBerlin(fire)).toBe(`${date}T09:00`);
  });

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
