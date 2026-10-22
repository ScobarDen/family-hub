import { expect, test } from "vite-plus/test";

import { formatAge, formatDate, formatDay, formatNearDate } from "./format-date.lib.ts";

const lateEveningInUtc = Date.parse("2026-10-11T22:30:00Z");

test("names the day and month in Russian", () => {
  expect(formatDay(Date.parse("2026-10-11T09:00:00Z"), "Europe/Moscow")).toBe("11 октября");
});

test("takes the day from the viewer's zone, not from UTC", () => {
  expect(formatDay(lateEveningInUtc, "Europe/Moscow")).toBe("12 октября");
  expect(formatDay(lateEveningInUtc, "America/New_York")).toBe("11 октября");
});

test.each([
  ["2025-10-11", "1 год"],
  ["2023-10-11", "3 года"],
  ["2016-05-01", "10 лет"],
  ["2004-01-01", "22 года"],
  ["2026-05-11", "5 месяцев"],
  ["2026-09-11", "1 месяц"],
  ["2026-10-01", "меньше месяца"],
])("tells the age of someone born on %s", (birthDate, age) => {
  expect(formatAge(birthDate, "2026-10-11")).toBe(age);
});

test("counts a year only once the birthday has come", () => {
  expect(formatAge("2025-10-12", "2026-10-11")).toBe("11 месяцев");
});

test("names a calendar date with its year", () => {
  expect(formatDate("2022-05-14")).toBe("14 мая 2022 г.");
});

test.each([
  ["2026-10-10", "Вчера"],
  ["2026-10-11", "Сегодня"],
  ["2026-10-12", "Завтра"],
  ["2026-10-23", "23 октября"],
  ["2027-01-05", "5 января 2027 г."],
])("names %s near 11 October 2026 in words, without this year", (date, words) => {
  expect(formatNearDate(date, "2026-10-11")).toBe(words);
});
