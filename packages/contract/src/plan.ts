import { z } from "zod";

import { optionalText } from "./text.ts";

export const visibility = z.enum(["shared", "private"]);

export type Visibility = z.infer<typeof visibility>;

export const planTitleMaxLength = 200;
export const planNoteMaxLength = 2000;

const title = z.string().trim().min(1).max(planTitleMaxLength);

export const planReminder = z.enum(["on-day", "1d", "1w"]);

export type PlanReminder = z.infer<typeof planReminder>;

export const subplanChange = z.object({
  title,
  dueDate: z.iso.date().nullable(),
  assigneeId: z.string().nullable(),
  reminder: planReminder.nullable().default(null),
});

export type SubplanChange = z.infer<typeof subplanChange>;

export const planChange = subplanChange.extend({
  note: optionalText(planNoteMaxLength),
  visibility,
  petId: z.string().nullable().default(null),
});

export type PlanChange = z.infer<typeof planChange>;

export const planMember = z.object({ id: z.string(), name: z.string() });

export type PlanMember = z.infer<typeof planMember>;

export const completion = z.object({ at: z.number(), by: z.string().nullable() });

export type Completion = z.infer<typeof completion>;

export const subplan = z.object({
  id: z.string(),
  title: z.string(),
  dueDate: z.string().nullable(),
  reminder: planReminder.nullable(),
  assignee: planMember.nullable(),
  completed: completion.nullable(),
});

export type Subplan = z.infer<typeof subplan>;

export const planPet = z.object({ id: z.string(), name: z.string() });

export const plan = subplan.extend({
  note: z.string().nullable(),
  pet: planPet.nullable(),
  visibility,
  isOwn: z.boolean(),
  subplans: z.array(subplan),
});

export type Plan = z.infer<typeof plan>;

export const planList = z.array(plan);

export type PlanList = z.infer<typeof planList>;

export const planDeleted = z.object({ status: z.literal("deleted") });

export type PlanDeleted = z.infer<typeof planDeleted>;
