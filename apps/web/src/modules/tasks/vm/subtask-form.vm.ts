import { action, atom, computed, reatomForm, type Atom } from "@reatom/core";
import { z } from "zod";

import { taskTitleMaxLength, type SubtaskChange, type Task } from "@family-hub/contract";

import { reatomEditableRecord } from "@/common/form";
import type { ClosingConfirmation, Haptics } from "@/common/telegram";

import type { TasksApi } from "../tasks.api.ts";
import type { TasksModel } from "../tasks.model.ts";
import type { PersonChoice } from "./task-form.vm.ts";

type SubtaskFormDependencies = {
  api: TasksApi;
  tasks: Pick<TasksModel, "keep" | "members">;
  self: () => string | undefined;
  haptics: Pick<Haptics, "success" | "error" | "select">;
  closingConfirmation: ClosingConfirmation;
  onSaved: (task: Task) => void;
};

type Edited = { task: Task; subtaskId: string };

const emptySubtask = { title: "", date: "" };

type SubtaskValues = typeof emptySubtask;

const schema = z.object({
  title: z.string().trim().min(1, "Введите название").max(taskTitleMaxLength, "Слишком длинно"),
  date: z.string(),
});

function valuesOf({ task, subtaskId }: Edited): SubtaskValues {
  const subtask = task.subtasks.find(({ id }) => id === subtaskId);

  return { title: subtask?.title ?? "", date: subtask?.date ?? "" };
}

type SubtaskPicks = { task: Atom<Task | undefined>; assigneeIds: Atom<string[]> };

function changeOf(values: SubtaskValues, assigneeIds: string[]): SubtaskChange {
  return {
    title: values.title.trim(),
    date: values.date === "" ? null : values.date,
    assigneeIds,
  };
}

function reatomSubtaskRecord(
  { api, tasks, haptics, closingConfirmation, onSaved }: SubtaskFormDependencies,
  { task, assigneeIds }: SubtaskPicks,
) {
  return reatomEditableRecord({
    name: "tasks.subtaskRecord",
    form: (onSubmit) => reatomForm(emptySubtask, { name: "tasks.subtaskForm", schema, onSubmit }),
    failureMessage: "Не получилось сохранить шаг. Попробуйте ещё раз.",
    haptics,
    closingConfirmation,
    valuesOf,
    create: async (values) => {
      const target = task();

      if (target === undefined) {
        throw new Error("No Task is open to add the Subtask to");
      }

      return api.addSubtask(target.id, changeOf(values, assigneeIds()));
    },
    update: async ({ task: target, subtaskId }: Edited, values) =>
      api.updateSubtask({ taskId: target.id, subtaskId }, changeOf(values, assigneeIds())),
    onSaved: (saved) => {
      tasks.keep(saved);
      onSaved(saved);
    },
  });
}

// Of a Private Task, only its owner may be assigned.
function reatomSubtaskAssignees(
  { tasks, self, haptics }: SubtaskFormDependencies,
  { task, assigneeIds }: SubtaskPicks,
) {
  return {
    assignees: computed(
      (): PersonChoice[] =>
        (tasks.members.data() ?? [])
          .filter(({ id }) => task()?.visibility !== "private" || id === self())
          .map(({ id, name, profilePicture }) => ({
            id,
            member: { name, profilePicture },
            isChosen: assigneeIds().includes(id),
          })),
      "tasks.subtaskForm.assignees",
    ),
    toggleAssignee: action((memberId: string) => {
      const chosen = assigneeIds();

      haptics.select();

      assigneeIds.set(
        chosen.includes(memberId) ? chosen.filter((id) => id !== memberId) : [...chosen, memberId],
      );
    }, "tasks.subtaskForm.toggleAssignee"),
  };
}

export function reatomSubtaskForm(dependencies: SubtaskFormDependencies) {
  const picks: SubtaskPicks = {
    task: atom<Task | undefined>(undefined, "tasks.subtaskForm.task"),
    assigneeIds: atom<string[]>([], "tasks.subtaskForm.assigneeIds"),
  };
  const { startCreating, startEditing, ...record } = reatomSubtaskRecord(dependencies, picks);

  return {
    ...record,
    ...reatomSubtaskAssignees(dependencies, picks),
    startAdding: action((target: Task) => {
      picks.task.set(target);
      picks.assigneeIds.set([]);
      startCreating(emptySubtask);
    }, "tasks.subtaskForm.startAdding"),
    startEditing: action((target: Task, subtaskId: string) => {
      picks.task.set(target);
      picks.assigneeIds.set(
        target.subtasks.find(({ id }) => id === subtaskId)?.assignees.map(({ id }) => id) ?? [],
      );
      startEditing({ task: target, subtaskId });
    }, "tasks.subtaskForm.startEditing"),
  };
}

export type SubtaskFormModel = ReturnType<typeof reatomSubtaskForm>;
