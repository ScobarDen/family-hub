import { expect, test } from "vite-plus/test";

import { formatShortCount } from "./format-count.lib.ts";

test("keeps a count under a thousand whole", () => {
  expect(formatShortCount(999)).toBe("999");
});

test("shortens thousands to «к», rounding down so it never overstates", () => {
  expect(formatShortCount(1_000)).toBe("1к");
  expect(formatShortCount(1_299)).toBe("1,2к");
  expect(formatShortCount(999_999)).toBe("999,9к");
});

test("shortens millions to «м»", () => {
  expect(formatShortCount(2_500_000)).toBe("2,5м");
});
