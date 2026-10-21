import type { CareDetails, CareEntryDraft, ExpenseCategory } from "@family-hub/contract";

import { dayOf, momentOf, rublesOf } from "./wording.ts";

const categoryTitles: Record<ExpenseCategory, string> = {
  food: "корм",
  vet: "ветеринар",
  medicine: "лекарства",
  grooming: "груминг",
  toys: "игрушки",
  other: "другое",
};

function visitTitleOf(reason: string | null): string {
  return reason === null ? "Визит к ветеринару" : `Визит к ветеринару: ${reason}`;
}

export function careTitleOf(details: CareDetails | null): string {
  if (details === null) {
    return "Запись";
  }

  if (details.kind === "vaccination") {
    return `Прививка «${details.vaccine}»`;
  }

  if (details.kind === "treatment") {
    return `Обработка «${details.target}»`;
  }

  if (details.kind === "vet_visit") {
    return visitTitleOf(details.reason);
  }

  if (details.kind === "weight") {
    return `Вес ${String(details.weightKg).replace(".", ",")} кг`;
  }

  return details.kind === "expense"
    ? `Трата ${rublesOf(details.amount)} · ${categoryTitles[details.category]}`
    : "Заметка";
}

function medicalDetailsOf(details: CareDetails | null): string[] {
  if (details === null || !("dueDate" in details)) {
    return [];
  }

  return [
    details.cost === null ? "" : rublesOf(details.cost.amount),
    details.dueDate === null ? "" : `следующий срок ${dayOf(details.dueDate)}`,
  ];
}

export function careDetailsOf(
  draft: CareEntryDraft,
  pets: Array<{ id: string; name: string }>,
): string[] {
  return [
    pets.find(({ id }) => id === draft.petId)?.name ?? "",
    draft.date === null ? "сейчас" : momentOf(draft),
    ...medicalDetailsOf(draft.details),
  ];
}
