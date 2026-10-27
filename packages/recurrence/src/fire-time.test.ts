import { describe, expect, test } from "vite-plus/test";

import { morningOf, taskReminderMoment } from "./fire-time.ts";
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

describe("a Task Reminder", () => {
  const timed = { time: "19:00", timeZone: "Europe/Moscow" };
  const dateOnly = { time: null, timeZone: null };

  test.each([
    ["at-start", "2026-10-22T16:00:00.000Z"],
    ["15m", "2026-10-22T15:45:00.000Z"],
    ["1h", "2026-10-22T15:00:00.000Z"],
    ["1d", "2026-10-21T16:00:00.000Z"],
    ["1w", "2026-10-15T16:00:00.000Z"],
  ] as const)("of a timed Task comes %s before its start", (offset, moment) => {
    const fire = taskReminderMoment("2026-10-22", {
      when: timed,
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
    "of a timed Task on %s keeps its wall-clock time %s before across a DST change",
    (date, offset, local) => {
      const fire = taskReminderMoment(date, {
        when: { time: "19:00", timeZone: berlin },
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
  ] as const)("of a Task without a time comes at 09:00 for %s", (offset, moment) => {
    const fire = taskReminderMoment("2026-10-22", {
      when: dateOnly,
      offset,
      recipientZone: "Europe/Moscow",
    });

    expect(iso(fire)).toBe(moment);
  });
});

describe("«at the moment» on a Task without a time", () => {
  test.each(["2026-03-29", "2026-10-25"])("comes at 09:00 on a DST change day %s", (date) => {
    const fire = taskReminderMoment(date, {
      when: { time: null, timeZone: null },
      offset: "at-start",
      recipientZone: berlin,
    });

    expect(inBerlin(fire)).toBe(`${date}T09:00`);
  });
});
