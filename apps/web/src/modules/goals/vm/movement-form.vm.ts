import { action, atom, computed, reatomForm, type Atom } from "@reatom/core";
import { z } from "zod";

import {
  movementChange,
  movementCommentMaxLength,
  type Goal,
  type MovementChange,
  type MovementKind,
} from "@family-hub/contract";

import { reatomEditableRecord } from "@/common/form";
import type { Choice } from "@/common/ui";

import type { GoalsApi } from "../goals.api.ts";
import type { GoalsModel } from "../goals.model.ts";

type MovementFormDependencies = {
  api: GoalsApi;
  goals: Pick<GoalsModel, "keep" | "members">;
  today: () => string;
  self: () => string | undefined;
  onSaved: (before: Goal, saved: Goal) => void;
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

function reatomMovementRecord(
  { api, goals, today, onSaved }: MovementFormDependencies,
  goal: Atom<Goal | undefined>,
) {
  return reatomEditableRecord({
    name: "goals.movementRecord",
    form: (onSubmit) =>
      reatomForm(emptyMovement, {
        name: "goals.movementForm",
        schema: schemaFor(today),
        onSubmit,
      }),
    failureMessage: "Не получилось сохранить. Баланс цели не может уйти в минус.",
    valuesOf,
    create: async (values): Promise<Saved> => {
      const before = goal();

      if (before === undefined) {
        throw new Error("No Goal is open to add the movement to");
      }

      return { before, saved: await api.addMovement(before.id, changeOf(values)) };
    },
    update: async ({ goal: before, movement }: Edited, values): Promise<Saved> => ({
      before,
      saved: await api.updateMovement(
        { goalId: before.id, movementId: movement.id },
        changeOf(values),
      ),
    }),
    onSaved: ({ before, saved }) => {
      goals.keep(saved);
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
