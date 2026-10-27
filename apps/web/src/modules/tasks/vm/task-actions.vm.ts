import {
  action,
  atom,
  computed,
  noop,
  take,
  throwAbort,
  withAsync,
  wrap,
  type Atom,
} from "@reatom/core";

import type { Task } from "@family-hub/contract";

import { reatomFailure } from "@/common/state";
import { type Confirmation, type Dialogs, isConfirmed } from "@/common/telegram";

import type { OccurrenceTarget, TasksApi } from "../tasks.api.ts";
import { completionOf } from "../tasks.lib.ts";
import type { TasksModel } from "../tasks.model.ts";

// What the undo bar offers after a tap on the circle: to take it back, and for a Pet's Task to
// record what was done in its journal.
export type Undo = OccurrenceTarget & { title: string; petId: string | undefined };

export type TaskActionsDependencies = {
  api: TasksApi;
  tasks: Pick<TasksModel, "keep" | "drop" | "list">;
  telegram: Pick<Dialogs, "showPopup">;
  opened: () => OccurrenceTarget | undefined;
  onDeleted: () => void;
  onRecord: (petId: string) => void;
};

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

function reatomChange() {
  return action(async (change: () => Promise<void>) => {
    await wrap(change());
  }, "tasks.change").extend(withAsync());
}

type Change = ReturnType<typeof reatomChange>;

type UndoAtom = Atom<Undo | undefined>;

// One tap completes; the undo bar takes it back, and a tap on a Completed one reopens it.
async function toggleCompletion(
  dependencies: TaskActionsDependencies,
  undo: UndoAtom,
  target: OccurrenceTarget,
): Promise<void> {
  const task = taskOf(dependencies, target.taskId);

  if (task === undefined) {
    return;
  }

  if (completionOf(task, target.occurrence) !== undefined) {
    undo.set(undefined);
    await keep(dependencies, dependencies.api.reopen(target));

    return;
  }

  await keep(dependencies, dependencies.api.complete(target));
  undo.set({ ...target, title: task.title, petId: task.pet?.id });
}

function onOpened(
  { opened }: TaskActionsDependencies,
  change: Change,
  run: (target: OccurrenceTarget) => Promise<void>,
): void {
  const target = opened();

  if (target !== undefined) {
    change(async () => run(target)).catch(noop);
  }
}

function reatomCompletion(dependencies: TaskActionsDependencies, change: Change, undo: UndoAtom) {
  return {
    undo,
    toggle: action((target: OccurrenceTarget) => {
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

      undo.set(undefined);

      if (target !== undefined) {
        change(async () => keep(dependencies, dependencies.api.reopen(target))).catch(noop);
      }
    }, "tasks.undoCompletion"),
    dismissUndo: action(() => {
      undo.set(undefined);
    }, "tasks.dismissUndo"),
    recordCareEntry: action(() => {
      const petId = undo()?.petId;

      undo.set(undefined);

      if (petId !== undefined) {
        dependencies.onRecord(petId);
      }
    }, "tasks.recordCareEntry"),
  };
}

function reatomOccurrenceChanges(dependencies: TaskActionsDependencies, change: Change) {
  return {
    skipOccurrence: action(() => {
      onOpened(dependencies, change, async ({ taskId, occurrence }) => {
        if (occurrence !== null && (await isSure(dependencies, "skip"))) {
          await keep(dependencies, dependencies.api.skip(taskId, occurrence));
          dependencies.onDeleted();
        }
      });
    }, "tasks.skipOccurrence"),
    removeTask: action(() => {
      onOpened(dependencies, change, async ({ taskId }) => {
        if (await isSure(dependencies, "delete")) {
          await wrap(dependencies.api.remove(taskId));
          dependencies.tasks.drop(taskId);
          dependencies.onDeleted();
        }
      });
    }, "tasks.removeTask"),
  };
}

function reatomSubtaskChanges(dependencies: TaskActionsDependencies, change: Change) {
  return {
    toggleSubtask: action((subtaskId: string) => {
      onOpened(dependencies, change, async ({ taskId }) => {
        const subtask = taskOf(dependencies, taskId)?.subtasks.find(({ id }) => id === subtaskId);
        const target = { taskId, subtaskId };

        await keep(
          dependencies,
          subtask?.completed === null
            ? dependencies.api.completeSubtask(target)
            : dependencies.api.reopenSubtask(target),
        );
      });
    }, "tasks.toggleSubtask"),
    removeSubtask: action((subtaskId: string) => {
      onOpened(dependencies, change, async ({ taskId }) => {
        if (await isSure(dependencies, "removeSubtask")) {
          await keep(dependencies, dependencies.api.removeSubtask({ taskId, subtaskId }));
        }
      });
    }, "tasks.removeSubtask"),
  };
}

// The bot's «Записать» completes the Occurrence before the journal opens, leaving no undo.
function reatomQuietCompletion(dependencies: TaskActionsDependencies) {
  const completeQuietly = action(async (target: OccurrenceTarget) => {
    const task = taskOf(dependencies, target.taskId);

    if (task === undefined || completionOf(task, target.occurrence) === undefined) {
      await wrap(keep(dependencies, dependencies.api.complete(target)));
    }
  }, "tasks.completeQuietly");

  return {
    completeQuietly,
    recordOccurrence: action(async (target: OccurrenceTarget) => {
      await wrap(take(dependencies.tasks.list.data, (tasks) => tasks ?? throwAbort()));

      const petId = taskOf(dependencies, target.taskId)?.pet?.id;

      if (petId !== undefined) {
        await wrap(completeQuietly(target));
        dependencies.onRecord(petId);
      }
    }, "tasks.recordOccurrence"),
  };
}

export function reatomTaskActions(dependencies: TaskActionsDependencies) {
  const change = reatomChange();
  const undo = atom<Undo | undefined>(undefined, "tasks.undo");

  return {
    failure: reatomFailure(change, {
      message: "Не получилось сохранить. Попробуйте ещё раз.",
      name: "tasks.failure",
    }),
    isChanging: computed(() => !change.ready(), "tasks.isChanging"),
    ...reatomCompletion(dependencies, change, undo),
    ...reatomUndoBar(dependencies, change, undo),
    ...reatomOccurrenceChanges(dependencies, change),
    ...reatomSubtaskChanges(dependencies, change),
    ...reatomQuietCompletion(dependencies),
  };
}

export type TaskActions = ReturnType<typeof reatomTaskActions>;
