import type { Pet, PetMemo } from "@family-hub/contract";

import { formatAge, formatDate, formatDay } from "@/common/format-date";

import { sexTitles, speciesTitles } from "./pets.config.ts";

export type PetListItem = { id: string; name: string; subtitle: string };

export type PetFact = { label: string; value: string };

export type PetMemoView = {
  food: string | undefined;
  clinic: string | undefined;
  important: string | undefined;
  updated: string | undefined;
};

export type PetCard = {
  id: string;
  name: string;
  subtitle: string;
  facts: PetFact[];
  memo: PetMemoView;
  soon: SoonItem[];
  isArchived: boolean;
};

export type Viewer = { today: string; timeZone: string };

export type SoonKind = "plan" | "due";

export type SoonSource = { id: string; title: string; dueDate: string | null; kind: SoonKind };

export type SoonItem = {
  id: string;
  kind: SoonKind;
  title: string;
  subtitle: string | undefined;
  isOverdue: boolean;
};

function byDueDate(left: SoonSource, right: SoonSource): number {
  if (left.dueDate === right.dueDate) {
    return 0;
  }

  if (left.dueDate === null || right.dueDate === null) {
    return left.dueDate === null ? 1 : -1;
  }

  return left.dueDate < right.dueDate ? -1 : 1;
}

export function toSoon(sources: SoonSource[], today: string): SoonItem[] {
  return sources.toSorted(byDueDate).map(({ id, title, dueDate, kind }) => {
    const isOverdue = dueDate !== null && dueDate < today;

    return {
      id,
      kind,
      title,
      subtitle:
        dueDate === null ? undefined : `${isOverdue ? "просрочено · " : ""}${formatDate(dueDate)}`,
      isOverdue,
    };
  });
}

function subtitleOf(pet: Pet, today: string): string {
  const age = pet.birthDate === null ? undefined : formatAge(pet.birthDate, today);

  return [speciesTitles[pet.species], pet.breed ?? undefined, age]
    .filter((part) => part !== undefined)
    .join(" · ");
}

function factsOf(pet: Pet): PetFact[] {
  const facts: Array<[string, string | undefined]> = [
    ["Пол", pet.sex === null ? undefined : sexTitles[pet.sex]],
    ["Дата рождения", pet.birthDate === null ? undefined : formatDate(pet.birthDate)],
    ["Номер чипа", pet.chipNumber ?? undefined],
    ["Заметки", pet.notes ?? undefined],
  ];

  return facts.flatMap(([label, value]) => (value === undefined ? [] : [{ label, value }]));
}

function memoOf(memo: PetMemo, timeZone: string): PetMemoView {
  const updated =
    memo.updatedAt === null
      ? undefined
      : [formatDay(memo.updatedAt, timeZone), memo.updatedBy].filter(Boolean).join(" · ");

  return {
    food: memo.food ?? undefined,
    clinic: memo.clinic ?? undefined,
    important: memo.important ?? undefined,
    updated: updated === undefined ? undefined : `Обновлено ${updated}`,
  };
}

export function toListItem(pet: Pet, { today }: Viewer): PetListItem {
  return { id: pet.id, name: pet.name, subtitle: subtitleOf(pet, today) };
}

export function toCard(pet: Pet, { today, timeZone }: Viewer, soonSources: SoonSource[]): PetCard {
  return {
    id: pet.id,
    name: pet.name,
    subtitle: subtitleOf(pet, today),
    facts: factsOf(pet),
    memo: memoOf(pet.memo, timeZone),
    soon: toSoon(soonSources, today),
    isArchived: pet.archivedAt !== null,
  };
}
