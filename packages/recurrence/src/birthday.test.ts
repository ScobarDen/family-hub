import { describe, expect, test } from "vite-plus/test";

import { birthdayFrom, birthdaysIn } from "./birthday.ts";

describe("the next birthday from a day", () => {
  test.each([
    ["later that year", "2022-10-20", "2026-10-01", "2026-10-20"],
    ["on the day itself", "2022-10-20", "2026-10-20", "2026-10-20"],
    ["the next year once it passed", "2022-10-20", "2026-10-21", "2027-10-20"],
    ["a year after birth, not the day of birth", "2022-10-20", "2022-10-01", "2023-10-20"],
    ["a year after birth, from the day of birth", "2022-10-20", "2022-10-20", "2023-10-20"],
    ["on 28 February in a year without 29", "2024-02-29", "2025-01-01", "2025-02-28"],
  ])("falls %s", (...[, birthDate, day, birthday]) => {
    expect(birthdayFrom(birthDate, day)).toBe(birthday);
  });
});

describe("birthdays in a range", () => {
  test("are each year's birthday inside it", () => {
    expect(birthdaysIn("2022-10-20", { from: "2025-10-01", to: "2027-10-20" })).toEqual([
      "2025-10-20",
      "2026-10-20",
      "2027-10-20",
    ]);
  });

  test("leave out the day of birth", () => {
    expect(birthdaysIn("2026-10-05", { from: "2026-10-01", to: "2026-10-14" })).toEqual([]);
  });
});
