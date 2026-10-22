import { describe, expect, test } from "vite-plus/test";

import {
  dateInZone,
  firstOccurrenceFrom,
  nthOccurrence,
  occurrenceDates,
  occurrenceMoment,
  occurrencesOnDays,
  timeInZone,
} from "./occurrence.ts";

const october = { from: "2026-10-01", to: "2026-10-31" };

describe("the nth Occurrence", () => {
  test.each([
    ["weekly", "2026-10-05", 3, "2026-10-26"],
    ["monthly", "2026-01-31", 1, "2026-02-28"],
    ["monthly", "2026-01-31", 2, "2026-03-31"],
    ["monthly", "2026-01-31", 3, "2026-04-30"],
    ["monthly", "2024-01-31", 1, "2024-02-29"],
    ["yearly", "2024-02-29", 1, "2025-02-28"],
    ["yearly", "2024-02-29", 4, "2028-02-29"],
  ] as const)(
    "of a %s series from %s, number %i, falls on %s",
    (...[frequency, start, index, date]) => {
      expect(nthOccurrence(start, frequency, index)).toBe(date);
    },
  );
});

describe("Occurrences in a range", () => {
  test.each([
    ["a single date inside", "2026-10-15", null, ["2026-10-15"]],
    ["a single date outside", "2026-11-15", null, []],
    [
      "a weekly series",
      "2026-09-24",
      { frequency: "weekly", until: null },
      ["2026-10-01", "2026-10-08", "2026-10-15", "2026-10-22", "2026-10-29"],
    ],
    [
      "a weekly series that ends",
      "2026-09-24",
      { frequency: "weekly", until: "2026-10-10" },
      ["2026-10-01", "2026-10-08"],
    ],
    [
      "a monthly series on the 31st",
      "2026-08-31",
      { frequency: "monthly", until: null },
      ["2026-10-31"],
    ],
    ["a yearly birthday", "2019-10-14", { frequency: "yearly", until: null }, ["2026-10-14"]],
    ["a series starting after the range", "2026-11-01", { frequency: "weekly", until: null }, []],
  ] as const)("of %s", (...[, start, recurrence, dates]) => {
    expect(occurrenceDates(start, recurrence, { range: october })).toEqual(dates);
  });

  test("leave out the skipped dates", () => {
    const dates = occurrenceDates(
      "2026-10-01",
      { frequency: "weekly", until: null },
      { range: october, skipped: ["2026-10-08", "2026-10-22"] },
    );

    expect(dates).toEqual(["2026-10-01", "2026-10-15", "2026-10-29"]);
  });

  test("of a short monthly series inside a month, the 30th of February included", () => {
    const dates = occurrenceDates(
      "2026-01-30",
      { frequency: "monthly", until: "2026-04-30" },
      { range: { from: "2026-01-01", to: "2026-12-31" } },
    );

    expect(dates).toEqual(["2026-01-30", "2026-02-28", "2026-03-30", "2026-04-30"]);
  });
});

describe("moments in the creator's zone", () => {
  test("keep a weekly 19:00 at 19:00 across the daylight-saving change", () => {
    const zone = { time: "19:00", timeZone: "Europe/Berlin" };
    const beforeChange = occurrenceMoment("2026-10-22", zone);
    const afterChange = occurrenceMoment("2026-10-29", zone);

    expect(new Date(beforeChange).toISOString()).toBe("2026-10-22T17:00:00.000Z");
    expect(new Date(afterChange).toISOString()).toBe("2026-10-29T18:00:00.000Z");
  });

  test("land on another day for a viewer far away", () => {
    const moment = occurrenceMoment("2026-10-22", { time: "19:00", timeZone: "Europe/Moscow" });

    expect(dateInZone(moment, "Asia/Vladivostok")).toBe("2026-10-23");
    expect(timeInZone(moment, "Asia/Vladivostok")).toBe("02:00");
  });
});

describe("the first Occurrence from a day", () => {
  test.each([
    ["is the start itself before it", "2026-10-05", null, "2026-10-01", "2026-10-05"],
    ["is none once a single date has passed", "2026-10-05", null, "2026-10-06", undefined],
    [
      "is that very day when it falls on it",
      "2026-01-05",
      { frequency: "weekly", until: null },
      "2026-10-12",
      "2026-10-12",
    ],
    [
      "is the next one after a gap",
      "2026-01-05",
      { frequency: "weekly", until: null },
      "2026-10-13",
      "2026-10-19",
    ],
    [
      "keeps the last day of a short month",
      "2026-01-31",
      { frequency: "monthly", until: null },
      "2026-02-01",
      "2026-02-28",
    ],
    [
      "is none after the series ends",
      "2026-01-05",
      { frequency: "weekly", until: "2026-03-01" },
      "2026-03-02",
      undefined,
    ],
    [
      "finds years ahead quickly",
      "2000-02-29",
      { frequency: "yearly", until: null },
      "2026-03-01",
      "2027-02-28",
    ],
  ] as const)("%s", (...[, start, recurrence, date, first]) => {
    expect(firstOccurrenceFrom(start, recurrence, date)).toBe(first);
  });
});

describe("Occurrences on the viewer's days", () => {
  const days = { from: "2026-10-05", to: "2026-10-06", timeZone: "Asia/Vladivostok" };

  test("places a timed Occurrence on the viewer's day of its moment", () => {
    const placed = occurrencesOnDays(
      { startDate: "2026-10-04", recurrence: { frequency: "weekly", until: null } },
      {
        days,
        momentOf: (occurrence) =>
          occurrenceMoment(occurrence, { time: "20:00", timeZone: "Europe/Moscow" }),
      },
    );

    expect(placed.map(({ occurrence, date }) => [occurrence, date])).toEqual([
      ["2026-10-04", "2026-10-05"],
    ]);
  });
});
