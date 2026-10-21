import { describe, expect, test } from "vite-plus/test";

import type { Goal } from "@family-hub/contract";

import { monthlyHint } from "./goals.lib.ts";

const goal: Goal = {
  id: "goal-1",
  title: "Отпуск",
  target: 90_000,
  deadline: "2027-01-14",
  icon: "plane",
  color: "blue",
  note: null,
  visibility: "shared",
  isOwn: true,
  balance: 0,
  isAchieved: false,
  completed: null,
  shares: [],
  movements: [],
};

describe("the monthly hint", () => {
  test.each([
    ["three whole months", { deadline: "2027-01-14" }, "~30 000 ₽ / мес"],
    ["a month started counts whole", { deadline: "2027-01-20" }, "~22 500 ₽ / мес"],
    ["less than a month left", { deadline: "2026-10-20" }, "~90 000 ₽ / мес"],
    ["a ruble rounds up", { target: 100_000, deadline: "2027-01-14" }, "~33 334 ₽ / мес"],
    ["the deadline passed", { deadline: "2026-10-01" }, "Срок прошёл"],
  ])("handles %s", (_case, change, hint) => {
    expect(monthlyHint({ ...goal, ...change }, "2026-10-14")).toBe(hint);
  });

  test.each([
    ["no deadline", { deadline: null }],
    ["the target reached", { balance: 90_000, isAchieved: true }],
    ["a Completed Goal", { completed: { at: 0, by: "Ася", outcome: "cancelled" as const } }],
  ])("is not shown with %s", (_case, change) => {
    expect(monthlyHint({ ...goal, ...change }, "2026-10-14")).toBeUndefined();
  });
});
