import {
  careKindTitles,
  expenseCategoryTitles,
  type CareDetails,
  type CareEntryDraft,
} from "@family-hub/contract";

import { dayOf, momentOf, rublesOf } from "./wording.ts";

function visitTitleOf(reason: string | null): string {
  return reason === null ? careKindTitles.vet_visit : `${careKindTitles.vet_visit}: ${reason}`;
}

export function careTitleOf(details: CareDetails | null): string {
  if (details === null) {
    return "Запись";
  }

  if (details.kind === "vaccination") {
    return `${careKindTitles.vaccination} «${details.vaccine}»`;
  }

  if (details.kind === "treatment") {
    return `${careKindTitles.treatment} «${details.target}»`;
  }

  if (details.kind === "vet_visit") {
    return visitTitleOf(details.reason);
  }

  if (details.kind === "weight") {
    return `${careKindTitles.weight} ${String(details.weightKg).replace(".", ",")} кг`;
  }

  return details.kind === "expense"
    ? `${careKindTitles.expense} ${rublesOf(details.amount)} · ${expenseCategoryTitles[details.category].toLowerCase()}`
    : careKindTitles.note;
}

function medicalDetailsOf({ details, repeatOn }: CareEntryDraft): string[] {
  if (details === null || !("cost" in details)) {
    return [];
  }

  return [
    details.cost === null ? "" : rublesOf(details.cost.amount),
    repeatOn === null ? "" : `повторить ${dayOf(repeatOn)}`,
  ];
}

export function careDetailsOf(
  draft: CareEntryDraft,
  pets: Array<{ id: string; name: string }>,
): string[] {
  return [
    pets.find(({ id }) => id === draft.petId)?.name ?? "",
    draft.date === null ? "сейчас" : momentOf(draft),
    ...medicalDetailsOf(draft),
  ];
}
