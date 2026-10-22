import { z } from "zod";

import { careEntryPhotoMax, photo } from "./photo.ts";
import { deleted, rubles } from "./primitive.ts";
import { optionalText } from "./text.ts";

export const careKind = z.enum([
  "vaccination",
  "treatment",
  "vet_visit",
  "weight",
  "expense",
  "note",
]);

export type CareKind = z.infer<typeof careKind>;

export const expenseCategory = z.enum(["food", "vet", "medicine", "grooming", "toys", "other"]);

export type ExpenseCategory = z.infer<typeof expenseCategory>;

export const careTextMaxLength = 200;
export const careNoteMaxLength = 2000;
export const weightMaxKg = 200;

const weightStepsPerKg = 10;
const roundingTolerance = 1e-9;

const name = z.string().trim().min(1).max(careTextMaxLength);
const dueDate = z.iso.date().nullable();

// The cost of a medical Care Entry is a Pet Expense of the vet or of medicine.
export const careCost = z.object({ amount: rubles, category: z.enum(["vet", "medicine"]) });

export type CareCost = z.infer<typeof careCost>;

export const careDetails = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("vaccination"), vaccine: name, cost: careCost.nullable(), dueDate }),
  z.object({
    kind: z.literal("treatment"),
    target: name,
    product: optionalText(careTextMaxLength),
    cost: careCost.nullable(),
    dueDate,
  }),
  z.object({
    kind: z.literal("vet_visit"),
    reason: optionalText(careTextMaxLength),
    cost: careCost.nullable(),
    dueDate,
  }),
  z.object({
    kind: z.literal("weight"),
    weightKg: z
      .number()
      .positive()
      .max(weightMaxKg)
      .refine(
        (kg) =>
          Math.abs(kg * weightStepsPerKg - Math.round(kg * weightStepsPerKg)) < roundingTolerance,
        "Step is 0.1 kg",
      ),
  }),
  z.object({ kind: z.literal("expense"), amount: rubles, category: expenseCategory }),
  z.object({ kind: z.literal("note") }),
]);

export type CareDetails = z.infer<typeof careDetails>;

export const careEntryChange = z.object({
  occurredAt: z.number().int().positive(),
  note: optionalText(careNoteMaxLength),
  details: careDetails,
  photoIds: z.array(z.string()).max(careEntryPhotoMax).default([]),
});

export type CareEntryChange = z.infer<typeof careEntryChange>;

export const careEntry = z.object({
  id: z.string(),
  petId: z.string(),
  occurredAt: z.number(),
  note: z.string().nullable(),
  details: careDetails,
  author: z.string().nullable(),
  photos: z.array(photo),
});

export type CareEntry = z.infer<typeof careEntry>;

export const careEntryList = z.array(careEntry);

export type CareEntryList = z.infer<typeof careEntryList>;

export const careEntryDeleted = deleted;

export type CareEntryDeleted = z.infer<typeof careEntryDeleted>;

export const expenseRange = z.object({
  from: z.coerce.number().int(),
  to: z.coerce.number().int(),
});

export const expenseSummary = z.object({
  total: z.number(),
  byCategory: z.array(z.object({ category: expenseCategory, amount: z.number() })),
  entries: z.array(
    z.object({
      id: z.string(),
      occurredAt: z.number(),
      kind: careKind,
      category: expenseCategory,
      amount: z.number(),
    }),
  ),
});

export type ExpenseSummary = z.infer<typeof expenseSummary>;

export const dueDateItem = z.object({
  entryId: z.string(),
  kind: z.enum(["vaccination", "treatment", "vet_visit"]),
  label: z.string(),
  title: z.string(),
  dueDate: z.iso.date(),
  isOverdue: z.boolean(),
});

export type DueDateItem = z.infer<typeof dueDateItem>;

export const dueDateList = z.array(dueDateItem);

export type DueDateList = z.infer<typeof dueDateList>;
