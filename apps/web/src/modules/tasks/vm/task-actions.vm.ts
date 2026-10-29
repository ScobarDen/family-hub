import { action, atom, computed, noop, wrap, type Atom } from "@reatom/core";

import type { Task } from "@family-hub/contract";

import { withoutId } from "@/common/records.lib.ts";
import { reatomOptimistic, reatomRollbackFailure } from "@/modules/changes";
import { type Confirmation, type Dialogs, isConfirmed, type Haptics } from "@/modules/telegram";

import {
  completionOf,
  withCompletion,
  withSkipped,
  withSubtaskCompletion,
} from "../occurrences.lib.ts";
import type { TaskOccurrence, TasksApi } from "../tasks.api.ts";
import type { TasksModel } from "../tasks.model.ts";

// What the undo bar offers after a tap on the circle: to take it back, and for a Pet's Task to
// record what was done in its journal.
export type Undo = TaskOccurrence & { title: string; petId: string | undefined };

export type TaskActionsDependencies = {
  api: TasksApi;
  tasks: Pick<TasksModel, "keep" | "drop" | "list" | "loaded">;
  telegram: Pick<Dialogs, "showPopup"> & { haptics: Haptics };
  opened: () => TaskOccurrence | undefined;
  onClosed: () => void;
  onRecord: (record: CareRecord) => void;
};

// What a Pet's Task tells its journal: whose it is and what was done.
export type CareRecord = { petId: string; title: string };

const confirmations: Record<"skip" | "delete" | "removeSubtask", Confirmation> = {
  skip: {
    title: "Пропустить этот раз?",
    message: "Остальные повторы останутся.",
    button: "Пропустить",
  },
  delete: {
    title: "Удалить дело?",
    message: "Дело и все его шаги пропадут у всей семьи.",
    button: "Удалить",
  },
  removeSubtask: {
    title: "Удалить шаг?",
    message: "Шаг пропадёт из дела у всей семьи.",
    button: "Удалить",
  },
};

function taskOf({ tasks }: TaskActionsDependencies, taskId: string): Task | undefined {
  return tasks.list.data()?.find(({ id }) => id === taskId);
}

async function keep({ tasks }: TaskActionsDependencies, saving: Promise<Task>): Promise<void> {
  tasks.keep(await wrap(saving));
}

async function isSure(dependencies: TaskActionsDependencies, kind: keyof typeof confirmations) {
  return wrap(isConfirmed(dependencies.telegram, confirmations[kind]));
}

function reatomChange({ telegram }: TaskActionsDependencies) {
  const failure = reatomRollbackFailure("tasks.failure", telegram.haptics);

  return {
    failure,
    change: reatomOptimistic(async (change: () => Promise<void>) => change(), {
      name: "tasks.change",
      failure,
      refusal: "Не получилось сохранить. Попробуйте ещё раз.",
    }),
  };
}

type Change = ReturnType<typeof reatomChange>["change"];

type UndoAtom = Atom<Undo | undefined>;

function feelCompletion({ telegram }: TaskActionsDependencies, isCompleted: boolean): void {
  if (isCompleted) {
    telegram.haptics.success();
  } else {
    telegram.haptics.select();
  }
}

// One tap completes; the undo bar takes it back, and a tap on a Completed one reopens it.
async function toggleCompletion(
  dependencies: TaskActionsDependencies,
  undo: UndoAtom,
  target: TaskOccurrence,
): Promise<void> {
  const task = taskOf(dependencies, target.taskId);

  if (task === undefined) {
    return;
  }

  const isCompleted = completionOf(task, target.occurrence) !== undefined;

  dependencies.tasks.keep(withCompletion(task, target.occurrence, !isCompleted));
  feelCompletion(dependencies, !isCompleted);

  if (isCompleted) {
    undo.set(undefined);
    await wrap(keep(dependencies, dependencies.api.reopen(target)));

    return;
  }

  await wrap(keep(dependencies, dependencies.api.complete(target)));
  undo.set({ ...target, title: task.title, petId: task.pet?.id });
}

function onOpened(
  { opened }: TaskActionsDependencies,
  change: Change,
  run: (target: TaskOccurrence) => Promise<void>,
): void {
  const target = opened();

  if (target !== undefined) {
    change(async () => run(target)).catch(noop);
  }
}

function reatomCompletion(dependencies: TaskActionsDependencies, change: Change, undo: UndoAtom) {
  return {
    undo,
    toggle: action((target: TaskOccurrence) => {
      change(async () => toggleCompletion(dependencies, undo, target)).catch(noop);
    }, "tasks.toggle"),
    toggleOpened: action(() => {
      onOpened(dependencies, change, async (target) =>
        toggleCompletion(dependencies, undo, target),
      );
    }, "tasks.toggleOpened"),
  };
}

function reatomUndoBar(dependencies: TaskActionsDependencies, change: Change, undo: UndoAtom) {
  return {
    undoCompletion: action(() => {
      const target = undo();

      const task = target && taskOf(dependencies, target.taskId);

      undo.set(undefined);

      if (target !== undefined && task !== undefined) {
        change(async () => {
          dependencies.tasks.keep(withCompletion(task, target.occurrence, false));
          dependencies.telegram.haptics.select();
          await wrap(keep(dependencies, dependencies.api.reopen(target)));
        }).catch(noop);
      }
    }, "tasks.undoCompletion"),
    dismissUndo: action(() => {
      undo.set(undefined);
    }, "tasks.dismissUndo"),
    recordCareEntry: action(() => {
      const completed = undo();

      undo.set(undefined);

      if (completed?.petId !== undefined) {
        dependencies.onRecord({ petId: completed.petId, title: completed.title });
      }
    }, "tasks.recordCareEntry"),
  };
}

function reatomOccurrenceChanges(dependencies: TaskActionsDependencies, change: Change) {
  return {
    skipOccurrence: action(() => {
      onOpened(dependencies, change, async ({ taskId, occurrence }) => {
        const task = taskOf(dependencies, taskId);

        if (
          task !== undefined &&
          occurrence !== null &&
          (await wrap(isSure(dependencies, "skip")))
        ) {
          dependencies.tasks.keep(withSkipped(task, occurrence));
          dependencies.telegram.haptics.select();
          dependencies.onClosed();
          await wrap(keep(dependencies, dependencies.api.skip(taskId, occurrence)));
        }
      });
    }, "tasks.skipOccurrence"),
    removeTask: action(() => {
      onOpened(dependencies, change, async ({ taskId }) => {
        if (await wrap(isSure(dependencies, "delete"))) {
          dependencies.tasks.drop(taskId);
          dependencies.onClosed();
          await wrap(dependencies.api.remove(taskId));
        }
      });
    }, "tasks.removeTask"),
  };
}

function reatomSubtaskChanges(dependencies: TaskActionsDependencies, change: Change) {
  return {
    toggleSubtask: action((subtaskId: string) => {
      onOpened(dependencies, change, async ({ taskId }) => {
        const task = taskOf(dependencies, taskId);
        const subtask = task?.subtasks.find(({ id }) => id === subtaskId);
        const target = { taskId, subtaskId };

        if (task === undefined || subtask === undefined) {
          return;
        }

        dependencies.tasks.keep(withSubtaskCompletion(task, subtaskId, subtask.completed === null));
        feelCompletion(dependencies, subtask.completed === null);
        await wrap(
          keep(
            dependencies,
            subtask.completed === null
              ? dependencies.api.completeSubtask(target)
              : dependencies.api.reopenSubtask(target),
          ),
        );
      });
    }, "tasks.toggleSubtask"),
    removeSubtask: action((subtaskId: string) => {
      onOpened(dependencies, change, async ({ taskId }) => {
        const task = taskOf(dependencies, taskId);

        if (task !== undefined && (await wrap(isSure(dependencies, "removeSubtask")))) {
          dependencies.tasks.keep({ ...task, subtasks: withoutId(task.subtasks, subtaskId) });
          await wrap(keep(dependencies, dependencies.api.removeSubtask({ taskId, subtaskId })));
        }
      });
    }, "tasks.removeSubtask"),
  };
}

// The bot's «Записать» completes the Occurrence before the journal opens, leaving no undo.
async function recordOccurrence(
  dependencies: TaskActionsDependencies,
  target: TaskOccurrence,
): Promise<void> {
  const tasks = await wrap(dependencies.tasks.loaded());
  const task = tasks.find(({ id }) => id === target.taskId);

  if (task === undefined || task.pet === null) {
    return;
  }

  if (completionOf(task, target.occurrence) === undefined) {
    await wrap(keep(dependencies, dependencies.api.complete(target)));
  }

  dependencies.onRecord({ petId: task.pet.id, title: task.title });
}

export function reatomTaskActions(dependencies: TaskActionsDependencies) {
  const { change, failure } = reatomChange(dependencies);
  const undo = atom<Undo | undefined>(undefined, "tasks.undo");

  return {
    // The undo bar and the failure bar share one place; the undo keeps it while it is offered.
    failure: computed(
      () => (undo() === undefined ? failure.failure() : undefined),
      "tasks.shownFailure",
    ),
    dismissFailure: failure.dismiss,
    ...reatomCompletion(dependencies, change, undo),
    ...reatomUndoBar(dependencies, change, undo),
    ...reatomOccurrenceChanges(dependencies, change),
    ...reatomSubtaskChanges(dependencies, change),
    recordOccurrence: action((target: TaskOccurrence) => {
      change(async () => recordOccurrence(dependencies, target)).catch(noop);
    }, "tasks.recordOccurrence"),
  };
}

export type TaskActions = ReturnType<typeof reatomTaskActions>;
