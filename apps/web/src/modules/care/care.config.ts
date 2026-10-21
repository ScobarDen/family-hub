import type { CareKind, ExpenseCategory } from "@family-hub/contract";

export const kindTitles: Record<CareKind, string> = {
  vaccination: "Прививка",
  treatment: "Обработка",
  vet_visit: "Ветеринар",
  weight: "Вес",
  expense: "Трата",
  note: "Заметка",
};

export const categoryTitles: Record<ExpenseCategory, string> = {
  food: "Корм",
  vet: "Ветеринар",
  medicine: "Лекарства",
  grooming: "Груминг",
  toys: "Игрушки",
  other: "Другое",
};

export const weightRanges = {
  quarter: "3 месяца",
  year: "Год",
  all: "Всё",
} as const;

export type WeightRange = keyof typeof weightRanges;
