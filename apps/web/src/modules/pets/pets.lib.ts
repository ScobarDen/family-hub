import { careKindTitles, type Pet, type PetMemo } from "@family-hub/contract";

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
  tasks: PetTaskRow[];
  // The next open vet visit among the Pet's Tasks, as «Повторить» and the old Due Dates titled it.
  nextVisit: string | undefined;
  isArchived: boolean;
  avatar: string | undefined;
};

export type Viewer = { today: string; timeZone: string };

// What the pet card reads of the Pet's Task rows, handed in by the tasks module.
export type PetTask = {
  key: string;
  taskId: string;
  title: string;
  when: string | undefined;
  isOverdue: boolean;
};

export type PetTaskRow = Omit<PetTask, "when"> & { subtitle: string | undefined };

function toTaskRow({ when, ...row }: PetTask): PetTaskRow {
  return {
    ...row,
    subtitle: row.isOverdue && when !== undefined ? `Просрочено · ${when}` : when,
  };
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

function memoOf(memo: PetMemo, viewer: Viewer): PetMemoView {
  const updated =
    memo.updatedAt === null
      ? undefined
      : [formatDay(memo.updatedAt, viewer), memo.updatedBy].filter(Boolean).join(" · ");

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

export function toCard(pet: Pet, viewer: Viewer, tasks: PetTask[]): PetCard {
  const { today } = viewer;

  return {
    id: pet.id,
    name: pet.name,
    subtitle: subtitleOf(pet, today),
    facts: factsOf(pet),
    memo: memoOf(pet.memo, viewer),
    tasks: tasks.map(toTaskRow),
    nextVisit: tasks.find(
      ({ title, when }) => when !== undefined && title.startsWith(careKindTitles.vet_visit),
    )?.when,
    isArchived: pet.archivedAt !== null,
    avatar: pet.avatar?.medium,
  };
}
