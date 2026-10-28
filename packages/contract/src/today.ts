import { z } from "zod";

import { feedUpcoming } from "./feed.ts";

export const todayNextCount = 3;

export const tileWindowDays = 7;

// One live number per section; Archived Pets and other Members' Private records count for no one.
// A tile that could not be read is null, so one failing section leaves the hub standing.
export const todayTiles = z.object({
  tasks: z.object({ open: z.number(), overdue: z.number(), week: z.number() }).nullable(),
  pet: z
    .object({
      activeCount: z.number(),
      only: z
        .object({
          petId: z.string(),
          name: z.string(),
          picture: z.string().nullable(),
          birthDate: z.iso.date().nullable(),
        })
        .nullable(),
    })
    .nullable(),
  goals: z
    .object({
      nearest: z.object({ goalId: z.string(), title: z.string(), percent: z.number() }).nullable(),
    })
    .nullable(),
  albums: z.object({ photos: z.number() }).nullable(),
  recipes: z.object({ count: z.number() }).nullable(),
});

export type TodayTiles = z.infer<typeof todayTiles>;

// `due` is what the morning digest lists that a Member can close: Overdue first, oldest first.
export const today = z.object({
  due: z.array(feedUpcoming),
  next: z.array(feedUpcoming),
  tiles: todayTiles,
});

export type Today = z.infer<typeof today>;
