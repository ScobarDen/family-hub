import { expect, test } from "vite-plus/test";

import { uuidv7 } from "./uuid.ts";

test("starts with the moment it was made, so ids sort by creation", () => {
  const earlier = uuidv7(Date.parse("2026-10-04T09:00:00Z"));
  const later = uuidv7(Date.parse("2026-10-04T09:00:00.001Z"));

  expect(earlier < later).toBe(true);
});

test("is a version 7 RFC 9562 UUID", () => {
  expect(uuidv7(Date.parse("2026-10-04T09:00:00Z"))).toMatch(
    /^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/,
  );
});
