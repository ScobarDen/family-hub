import { describe, expect, test } from "vite-plus/test";

import { momentOfPhrase } from "./phrase.ts";

const phrase = { saidAt: Date.parse("2026-10-13T06:30:00Z"), timeZone: "Europe/Moscow" };

describe("the moment a phrase names", () => {
  test("is the moment it was said when it names no date", () => {
    expect(momentOfPhrase({ date: null, time: null }, phrase)).toBe(phrase.saidAt);
  });

  test("keeps the time of day it was said at, in its zone, when it names a date alone", () => {
    expect(momentOfPhrase({ date: "2026-10-12", time: null }, phrase)).toBe(
      Date.parse("2026-10-12T06:30:00Z"),
    );
  });

  test("is the date and time it names, in the zone it was said in", () => {
    expect(momentOfPhrase({ date: "2026-10-12", time: "19:00" }, phrase)).toBe(
      Date.parse("2026-10-12T16:00:00Z"),
    );
  });
});
