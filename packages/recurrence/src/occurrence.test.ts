import { describe, expect, test } from "vite-plus/test";

import {
  dateInZone,
  nthOccurrence,
  occurrenceDates,
  occurrenceMoment,
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
