import type { CareDetails, DueDateItem } from "@family-hub/contract";

export type DuePet = { id: string; name: string; archivedAt: number | null };

export type DueEntry = {
  id: string;
  petId: string;
  details: CareDetails;
  dueDate: string | null;
  dueKey: string | null;
  occurredAt: number;
};

export type OpenDueDate = {
  entryId: string;
  petId: string;
  kind: DueDateItem["kind"];
  // What is due, without its kind or Pet: a vaccine, a treatment target or the vet visit.
  name: string;
  title: string;
  dueDate: string;
};

const vetVisitName = "Визит к ветеринару";

// A later entry of the same vaccine, treatment target or a vet visit closes the earlier Due Date.
export function dueKeyOf(details: CareDetails): string | null {
  if (details.kind === "vaccination") {
    return details.vaccine.toLowerCase();
  }

  if (details.kind === "treatment") {
    return details.target.toLowerCase();
  }

  return details.kind === "vet_visit" ? "vet_visit" : null;
}

function newestOfEachKey(entries: DueEntry[]): DueEntry[] {
  const newest = new Map<string, DueEntry>();

  for (const entry of entries) {
    const key = `${entry.petId}:${entry.dueKey}`;
    const held = newest.get(key);

    if (entry.dueKey !== null && (held === undefined || entry.occurredAt > held.occurredAt)) {
      newest.set(key, entry);
    }
  }

  return [...newest.values()];
}

type Subject = { kind: OpenDueDate["kind"]; name: string; label: string };

function subjectOf(details: CareDetails): Subject | undefined {
  if (details.kind === "vaccination") {
    return { kind: details.kind, name: details.vaccine, label: `Прививка: ${details.vaccine}` };
  }

  if (details.kind === "treatment") {
    return { kind: details.kind, name: details.target, label: `Обработка: ${details.target}` };
  }

  return details.kind === "vet_visit"
    ? { kind: details.kind, name: vetVisitName, label: vetVisitName }
    : undefined;
}

function openDueOf({ id, details, dueDate }: DueEntry, pet: DuePet): OpenDueDate[] {
  const subject = subjectOf(details);

  return dueDate === null || subject === undefined
    ? []
    : [
        {
          entryId: id,
          petId: pet.id,
          kind: subject.kind,
          name: subject.name,
          title: `${subject.label} — ${pet.name}`,
          dueDate,
        },
      ];
}

// The newest entry of each due key holds its Due Date: a later entry of the same key closes the
// earlier one, and one without a date closes it for good. An archived Pet has none open.
export function openDueDates({
  pets,
  entries,
}: {
  pets: DuePet[];
  entries: DueEntry[];
}): OpenDueDate[] {
  const activePets = new Map(
    pets.filter(({ archivedAt }) => archivedAt === null).map((pet) => [pet.id, pet]),
  );

  return newestOfEachKey(entries)
    .flatMap((entry) => {
      const pet = activePets.get(entry.petId);

      return pet === undefined ? [] : openDueOf(entry, pet);
    })
    .toSorted((left, right) => left.dueDate.localeCompare(right.dueDate));
}
