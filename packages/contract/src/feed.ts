import { z } from "zod";

import { dueCareKind } from "./care-entry.ts";
import { profilePicture } from "./member.ts";
import { photo } from "./photo.ts";

export const feedPageSize = 30;

export const feedPhotoPreview = 3;

// Uploads by one Member to one Album with pauses under ten minutes make one line.
export const uploadBatchGapMs = 600_000;

export const feedUpcomingDays = 14;

const dated = { key: z.string(), title: z.string(), date: z.iso.date() };

// The thumbnail of the Pet Avatar, so a Pet's line shows whose it is at a glance.
const petPicture = z.string().nullable();

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
  z.object({
    kind: z.literal("due"),
    ...dated,
    careKind: dueCareKind,
    petId: z.string(),
    petPicture,
    entryId: z.string(),
  }),
  z.object({ kind: z.literal("birthday"), ...dated, petId: z.string(), petPicture }),
]);

export type FeedUpcoming = z.infer<typeof feedUpcoming>;

const done = {
  key: z.string(),
  at: z.number(),
  memberName: z.string(),
  memberPicture: profilePicture,
};

// Up to three thumbnails come along; photoCount says how many there are in all.
const withPhotos = { photos: z.array(photo), photoCount: z.number() };

const feedActivity = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("care"),
    ...done,
    ...withPhotos,
    title: z.string(),
    petId: z.string(),
    entryId: z.string(),
  }),
  z.object({
    kind: z.literal("upload"),
    ...done,
    ...withPhotos,
    albumId: z.string(),
    albumTitle: z.string(),
  }),
  z.object({ kind: z.literal("plan"), ...done, title: z.string(), planId: z.string() }),
  z.object({ kind: z.literal("goal"), ...done, title: z.string(), goalId: z.string() }),
  z.object({
    kind: z.literal("cooked"),
    ...done,
    ...withPhotos,
    title: z.string(),
    recipeId: z.string(),
  }),
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
