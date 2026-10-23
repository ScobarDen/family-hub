import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import type { Membership } from "@/common/auth";

import { createTodayService } from "./today.service.ts";
import type { TileSources } from "./today.types.ts";

const viewer: Membership = {
  member: {
    id: "member-1",
    name: "Денис",
    telegramId: 111,
    canMessage: true,
    timeZone: "Europe/Moscow",
  },
  family: { id: "family-1", name: "Гущины" },
  isFamilyOwner: true,
};

function tilesWith(failing: keyof TileSources): TileSources {
  const tiles: TileSources = {
    plans: { tile: async () => ({ open: 2, overdue: 0 }) },
    calendar: { tile: async () => ({ events: 1 }) },
    pet: { tile: async () => ({ activeCount: 0, only: null, due: null }) },
    goals: { tile: async () => ({ nearest: null }) },
    albums: { tile: async () => ({ photos: 3 }) },
    recipes: { tile: async () => ({ lastCooked: null }) },
  };

  return { ...tiles, [failing]: { tile: async () => Promise.reject(new Error("D1 is down")) } };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the Today hub", () => {
  test("keeps standing with the other tiles when one section cannot be read", async () => {
    vi.spyOn(console, "error").mockReturnValue();

    const service = createTodayService({
      feed: { todayOf: async () => ({ due: [], next: [] }) },
      tiles: tilesWith("plans"),
      clock: { now: () => Date.parse("2026-10-02T06:00:00Z") },
    });

    const today = await service.of(viewer);

    expect(today.tiles).toMatchObject({
      plans: null,
      calendar: { events: 1 },
      albums: { photos: 3 },
    });
  });
});
