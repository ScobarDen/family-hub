import { z } from "zod";

export const feedPageSize = 30;

export const feedUpcomingDays = 14;

const dated = { key: z.string(), title: z.string(), date: z.iso.date() };

export const feedUpcoming = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("event"),
    ...dated,
    time: z.string().nullable(),
    eventId: z.string(),
  }),
  z.object({ kind: z.literal("reminder"), ...dated, time: z.string(), reminderId: z.string() }),
  z.object({
    kind: z.literal("plan"),
    ...dated,
    planId: z.string(),
    subplanId: z.string().nullable(),
  }),
  z.object({ kind: z.literal("due"), ...dated, petId: z.string(), entryId: z.string() }),
  z.object({ kind: z.literal("birthday"), ...dated, petId: z.string() }),
]);

export type FeedUpcoming = z.infer<typeof feedUpcoming>;

const done = { key: z.string(), at: z.number(), memberName: z.string() };

export const feedActivity = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("care"),
    ...done,
    title: z.string(),
    petId: z.string(),
    entryId: z.string(),
  }),
  z.object({ kind: z.literal("plan"), ...done, title: z.string(), planId: z.string() }),
  z.object({ kind: z.literal("goal"), ...done, title: z.string(), goalId: z.string() }),
  z.object({ kind: z.literal("joined"), ...done }),
]);

export type FeedActivity = z.infer<typeof feedActivity>;

// The first page carries what is overdue and upcoming; later pages only older Activity.
export const feedPage = z.object({
  overdue: z.array(feedUpcoming),
  upcoming: z.array(feedUpcoming),
  activity: z.array(feedActivity),
  next: z.string().nullable(),
});

export type FeedPage = z.infer<typeof feedPage>;
