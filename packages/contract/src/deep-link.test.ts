import { describe, expect, test } from "vite-plus/test";
import { ZodError } from "zod";

import { encodeDeepLink, parseDeepLink } from "./deep-link.ts";

describe("encoding", () => {
  test("joins the kind and the id with an underscore", () => {
    expect(encodeDeepLink({ kind: "inv", id: "Ab3_x-9" })).toBe("inv_Ab3_x-9");
  });

  test("refuses an id Telegram would not carry", () => {
    expect(() => encodeDeepLink({ kind: "pet", id: "a b" })).toThrow(ZodError);
  });

  test("refuses a payload longer than 64 characters", () => {
    expect(() => encodeDeepLink({ kind: "inv", id: "a".repeat(61) })).toThrow(ZodError);
  });
});

describe("parsing", () => {
  test("reads back what was encoded, underscores in the id included", () => {
    expect(parseDeepLink("inv_Ab3_x-9")).toEqual({ kind: "inv", id: "Ab3_x-9" });
  });

  test("reads a Pet link with a UUID", () => {
    expect(parseDeepLink("pet_0199b4d2-6c00-7abc-8def-0123456789ab")).toEqual({
      kind: "pet",
      id: "0199b4d2-6c00-7abc-8def-0123456789ab",
    });
  });

  test("reads a Command Draft link the bot's «Изменить» opens", () => {
    expect(parseDeepLink("cmd_0199b4d2-6c00-7abc-8def-0123456789ab")).toEqual({
      kind: "cmd",
      id: "0199b4d2-6c00-7abc-8def-0123456789ab",
    });
  });

  test.each([
    ["no payload", undefined],
    ["an empty payload", ""],
    ["an unknown kind", "dog_123"],
    ["a kind without an id", "inv_"],
    ["no separator", "inv"],
    ["a forbidden character", "inv_abc!"],
    ["a payload longer than 64 characters", `inv_${"a".repeat(61)}`],
  ])("ignores %s", (_case, raw) => {
    expect(parseDeepLink(raw)).toBeUndefined();
  });
});
