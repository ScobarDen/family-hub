import { z } from "zod";

import { named, rubles } from "./primitive.ts";
import { visibility } from "./task.ts";
import { optionalText } from "./text.ts";

export const goalTitleMaxLength = 200;
export const goalNoteMaxLength = 2000;
export const movementCommentMaxLength = 500;

// A cover is one of a curated set of lucide icons on one of the app's badge colours.
export const goalIcon = z.enum([
  "plane",
  "palmtree",
  "house",
  "car",
  "sofa",
  "laptop",
  "gift",
  "baby",
  "graduation-cap",
  "heart",
  "paw-print",
  "piggy-bank",
]);

export type GoalIcon = z.infer<typeof goalIcon>;

export const goalColor = z.enum(["blue", "green", "orange", "red", "violet", "teal", "pink"]);

export type GoalColor = z.infer<typeof goalColor>;

export const goalChange = z.object({
  title: z.string().trim().min(1).max(goalTitleMaxLength),
  target: rubles,
  deadline: z.iso.date().nullable(),
  icon: goalIcon,
  color: goalColor,
  note: optionalText(goalNoteMaxLength),
  visibility,
});

export type GoalChange = z.infer<typeof goalChange>;

const movementKind = z.enum(["contribution", "withdrawal"]);

export type MovementKind = z.infer<typeof movementKind>;

export const movementChange = z.object({
  kind: movementKind,
  amount: rubles,
  date: z.iso.date(),
  // Whose money it is; the Member who records it when left out.
  memberId: z.string().nullable().default(null),
  comment: optionalText(movementCommentMaxLength),
});

export type MovementChange = z.infer<typeof movementChange>;

const goalOutcome = z.enum(["fulfilled", "cancelled"]);

export type GoalOutcome = z.infer<typeof goalOutcome>;

export const goalCompletion = z.object({ outcome: goalOutcome });

export const movement = z.object({
  id: z.string(),
  kind: movementKind,
  amount: z.number(),
  date: z.string(),
  member: named,
  recordedBy: named,
  comment: z.string().nullable(),
  isOwn: z.boolean(),
});

export type Movement = z.infer<typeof movement>;

const goalShare = named.extend({ contributed: z.number(), withdrawn: z.number() });

export type GoalShare = z.infer<typeof goalShare>;

export const goal = z.object({
  id: z.string(),
  title: z.string(),
  target: z.number(),
  deadline: z.string().nullable(),
  icon: goalIcon,
  color: goalColor,
  note: z.string().nullable(),
  visibility,
  isOwn: z.boolean(),
  balance: z.number(),
  isAchieved: z.boolean(),
  completed: z.object({ at: z.number(), by: z.string(), outcome: goalOutcome }).nullable(),
  shares: z.array(goalShare),
  movements: z.array(movement),
});

export type Goal = z.infer<typeof goal>;

// The total counts what is still being saved: Shared Goals and the Member's own Private ones.
export const goalList = z.object({ goals: z.array(goal), totalSaved: z.number() });

export type GoalList = z.infer<typeof goalList>;
