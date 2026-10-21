import { expect, test } from "vite-plus/test";

import { formatRubles } from "./format-money.lib.ts";

test("shows whole rubles with non-breaking spaces, so a sum never wraps", () => {
  expect(formatRubles(3200)).toBe("3 200 ₽");
});
