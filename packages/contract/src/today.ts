import { z } from "zod";

import { feedUpcoming } from "./feed.ts";

export const todayNextCount = 3;

export const tileWindowDays = 7;

const pending = z.object({ label: z.string(), date: z.iso.date() });

// One live number per section; Archived Pets and other Members' Private records count for no one.
// A tile that could not be read is null, so one failing section leaves the hub standing.
export const todayTiles = z.object({
  plans: z.object({ open: z.number(), overdue: z.number() }).nullable(),
  calendar: z.object({ events: z.number() }).nullable(),
  pet: z
    .object({
      activeCount: z.number(),
      only: z.object({ petId: z.string(), name: z.string() }).nullable(),
      due: pending.nullable(),
    })
    .nullable(),
  goals: z
    .object({
      nearest: z.object({ goalId: z.string(), title: z.string(), percent: z.number() }).nullable(),
    })
    .nullable(),
  albums: z.object({ photos: z.number() }).nullable(),
  recipes: z
    .object({ lastCooked: z.object({ recipeId: z.string(), title: z.string() }).nullable() })
    .nullable(),
});

export type TodayTiles = z.infer<typeof todayTiles>;

// `due` is what the morning digest lists that a Member can close: Overdue first, oldest first.
export const today = z.object({
  due: z.array(feedUpcoming),
  next: z.array(feedUpcoming),
  tiles: todayTiles,
});

export type Today = z.infer<typeof today>;
