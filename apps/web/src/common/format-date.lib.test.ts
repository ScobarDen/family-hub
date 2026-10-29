import { expect, test } from "vite-plus/test";

import {
  formatAge,
  formatDate,
  formatDay,
  formatDayTime,
  formatFullAge,
  formatNearDate,
  formatPickedValue,
  formatShortAge,
  formatTimeZone,
} from "./format-date.lib.ts";

const lateEveningInUtc = Date.parse("2026-10-11T22:30:00Z");

const moscow = { timeZone: "Europe/Moscow", today: "2026-10-23" };

test("names the day and month in Russian", () => {
  expect(formatDay(Date.parse("2026-10-11T09:00:00Z"), moscow)).toBe("11 октября");
});

test("takes the day from the viewer's zone, not from UTC", () => {
  expect(formatDay(lateEveningInUtc, moscow)).toBe("12 октября");
  expect(formatDay(lateEveningInUtc, { ...moscow, timeZone: "America/New_York" })).toBe(
    "11 октября",
  );
});

test("adds the time in the viewer's zone to the day", () => {
  expect(formatDayTime(lateEveningInUtc, moscow)).toBe("12 октября, 01:30");
});

test("keeps the year of a day from another year", () => {
  expect(formatDay(Date.parse("2025-10-20T09:00:00Z"), moscow)).toBe("20 октября 2025 г.");
});

test("names a zone by its place and offset", () => {
  expect(formatTimeZone("Europe/Moscow")).toBe("Москва (GMT+3)");
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

test.each([
  ["2025-09-11", "1\u00A0г 1\u00A0м"],
  ["2023-08-01", "3\u00A0г 2\u00A0м"],
  ["2014-09-01", "12\u00A0л 1\u00A0м"],
  ["2016-10-11", "10\u00A0л"],
  ["2026-05-11", "5\u00A0м"],
  ["2026-10-01", "0\u00A0м"],
])("tells the age in years and months on a tile for someone born on %s", (birthDate, age) => {
  expect(formatShortAge(birthDate, "2026-10-11")).toBe(age);
});

test("says the tile's age in full words", () => {
  expect(formatFullAge("2025-09-11", "2026-10-11")).toBe("1 год 1 месяц");
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

test.each([
  ["date", "2026-10-30", "пт, 30 окт"],
  ["date", "2027-05-01", "сб, 1 мая 2027"],
  ["time", "09:05", "09:05"],
  ["datetime-local", "2026-10-30T14:05", "пт, 30 окт, 14:05"],
] as const)("shows a picked %s %s as «%s» on 28 October 2026", (type, value, words) => {
  expect(formatPickedValue(type, value, "2026-10-28")).toBe(words);
});

test.each([
  ["date", "Не выбрана"],
  ["time", "Не выбрано"],
  ["datetime-local", "Не выбрано"],
] as const)("tells an empty %s field is not chosen", (type, words) => {
  expect(formatPickedValue(type, "", "2026-10-28")).toBe(words);
});
