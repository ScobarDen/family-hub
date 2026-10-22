import type { CareKind, ExpenseCategory } from "@family-hub/contract";

import type { Choice } from "@/common/ui";

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

export type KindField = {
  name:
    | "weightKg"
    | "amount"
    | "category"
    | "name"
    | "product"
    | "reason"
    | "costAmount"
    | "costCategory"
    | "dueDate";
  label: string;
  placeholder?: string;
  type?: "date";
  choices?: Choice[];
};

const costChoices: Choice[] = [
  { value: "vet", title: categoryTitles.vet },
  { value: "medicine", title: categoryTitles.medicine },
];

const costFields: KindField[] = [
  { name: "costAmount", label: "Стоимость, ₽" },
  { name: "costCategory", label: "Стоимость — это", choices: costChoices },
  { name: "dueDate", label: "Повторить до", type: "date" },
];

// What each kind of entry asks for besides its time and note.
export const kindFields: Record<CareKind, KindField[]> = {
  vaccination: [{ name: "name", label: "Вакцина" }, ...costFields],
  treatment: [
    { name: "name", label: "От чего" },
    { name: "product", label: "Препарат" },
    ...costFields,
  ],
  vet_visit: [{ name: "reason", label: "Причина" }, ...costFields],
  weight: [{ name: "weightKg", label: "Вес, кг", placeholder: "12,4" }],
  expense: [
    { name: "amount", label: "Сумма, ₽" },
    {
      name: "category",
      label: "Категория",
      choices: Object.entries(categoryTitles).map(([value, title]) => ({ value, title })),
    },
  ],
  note: [],
};
