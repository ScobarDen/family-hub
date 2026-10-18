import { expect, test } from "vite-plus/test";

import { formatDay } from "./format-date.lib.ts";

const lateEveningInUtc = Date.parse("2026-10-11T22:30:00Z");

test("names the day and month in Russian", () => {
  expect(formatDay(Date.parse("2026-10-11T09:00:00Z"), "Europe/Moscow")).toBe("11 октября");
});

test("takes the day from the viewer's zone, not from UTC", () => {
  expect(formatDay(lateEveningInUtc, "Europe/Moscow")).toBe("12 октября");
  expect(formatDay(lateEveningInUtc, "America/New_York")).toBe("11 октября");
});
