import { action, atom, computed, reatomForm, wrap, type Atom } from "@reatom/core";
import { z } from "zod";

import {
  movementChange,
  movementCommentMaxLength,
  type Goal,
  type MovementChange,
  type MovementKind,
} from "@family-hub/contract";

import { reatomEditableRecord } from "@/modules/form";
import type { ClosingConfirmation, Haptics } from "@/modules/telegram";
import type { Choice } from "@/modules/ui";

import type { GoalsApi } from "../goals.api.ts";
import { withMovement } from "../goals.lib.ts";
import type { GoalsModel } from "../goals.model.ts";

type MovementFormDependencies = {
  api: GoalsApi;
  goals: Pick<GoalsModel, "keep" | "members">;
  today: () => string;
  self: () => string | undefined;
  haptics: Pick<Haptics, "success" | "error">;
  closingConfirmation: ClosingConfirmation;
  onSaved: (before: Goal, saved: Goal) => void;
  onAdding: (before: Goal, change: MovementChange, shown: Goal) => void;
};

const emptyMovement = { kind: "contribution", amount: "", date: "", memberId: "", comment: "" };

type MovementValues = typeof emptyMovement;

function schemaFor(today: () => string) {
  return z
    .object({
      kind: z.string(),
      amount: z.string().regex(/^[1-9]\d*$/u, "Целое число рублей больше нуля"),
      date: z.string().min(1, "Укажите дату"),
      memberId: z.string(),
      comment: z.string().max(movementCommentMaxLength, "Слишком длинно"),
    })
    .superRefine((values, issues) => {
      if (values.date > today()) {
        issues.addIssue({ code: "custom", path: ["date"], message: "Дата ещё не наступила" });
      }
    });
}

function changeOf(values: MovementValues): MovementChange {
  return movementChange.parse({
    ...values,
    amount: Number(values.amount),
    memberId: values.memberId === "" ? null : values.memberId,
  });
}

type Movement = Goal["movements"][number];

type Edited = { goal: Goal; movement: Movement };

type Saved = { before: Goal; saved: Goal };

// A Private Goal takes only its owner's money, so it offers nobody else.
function reatomContributors(
  { goals, self }: MovementFormDependencies,
  goal: Atom<Goal | undefined>,
) {
  return computed((): Choice[] => {
    const members = goals.members.data() ?? [];
    const allowed =
      goal()?.visibility === "private" ? members.filter(({ id }) => id === self()) : members;

    return allowed.map(({ id, name }) => ({ value: id, title: name }));
  }, "goals.movementForm.contributors");
}

function valuesOf({ movement }: Edited): MovementValues {
  return {
    kind: movement.kind,
    amount: String(movement.amount),
    date: movement.date,
    memberId: movement.member.id,
    comment: movement.comment ?? "",
  };
}

// A Movement not yet saved has no id of its own and offers no editing until the server answers.
function shownMovement(
  { goals, self }: MovementFormDependencies,
  change: MovementChange,
): Goal["movements"][number] {
  const members = goals.members.data() ?? [];

  function named(id: string | null | undefined) {
    const { name = "" } = members.find((member) => member.id === id) ?? {};

    return { id: id ?? "", name };
  }

  return {
    id: `unsaved-${String(Date.now())}`,
    kind: change.kind,
    amount: change.amount,
    date: change.date,
    member: named(change.memberId ?? self()),
    recordedBy: named(self()),
    comment: change.comment ?? null,
    isOwn: false,
  };
}

function reatomMovementRecord(
  dependencies: MovementFormDependencies,
  goal: Atom<Goal | undefined>,
) {
  const { api, goals, today, haptics, closingConfirmation, onSaved, onAdding } = dependencies;

  return reatomEditableRecord({
    name: "goals.movementRecord",
    form: (onSubmit) =>
      reatomForm(emptyMovement, {
        name: "goals.movementForm",
        schema: schemaFor(today),
        onSubmit,
      }),
    failureMessage: "Не получилось сохранить. Баланс цели не может уйти в минус.",
    haptics,
    closingConfirmation,
    valuesOf,
    create: async (values): Promise<Saved> => {
      const before = goal();

      if (before === undefined) {
        throw new Error("No Goal is open to add the movement to");
      }

      const change = changeOf(values);
      const shown = withMovement(before, shownMovement(dependencies, change));

      onAdding(before, change, shown);

      return { before, saved: shown };
    },
    update: async ({ goal: before, movement }: Edited, values): Promise<Saved> => {
      const saved = await wrap(
        api.updateMovement({ goalId: before.id, movementId: movement.id }, changeOf(values)),
      );

      goals.keep(saved);

      return { before, saved };
    },
    onSaved: ({ before, saved }) => {
      onSaved(before, saved);
    },
  });
}

export function reatomMovementForm(dependencies: MovementFormDependencies) {
  const goal = atom<Goal | undefined>(undefined, "goals.movementForm.goal");
  const { startCreating, startEditing, ...record } = reatomMovementRecord(dependencies, goal);
  const contributors = reatomContributors(dependencies, goal);

  return {
    ...record,
    contributors,
    // A Goal with one possible contributor needs no «Чей вклад».
    hasContributorChoice: computed(
      () => contributors().length > 1,
      "goals.movementForm.hasContributorChoice",
    ),

    startAdding: action((target: Goal, kind: MovementKind) => {
      goal.set(target);
      startCreating({
        ...emptyMovement,
        kind,
        date: dependencies.today(),
        memberId: dependencies.self() ?? "",
      });
    }, "goals.movementForm.startAdding"),
    startEditing: action((target: Goal, movementId: string) => {
      const movement = target.movements.find(({ id }) => id === movementId);

      if (movement !== undefined) {
        goal.set(target);
        startEditing({ goal: target, movement });
      }
    }, "goals.movementForm.startEditing"),
  };
}

export type MovementFormModel = ReturnType<typeof reatomMovementForm>;
