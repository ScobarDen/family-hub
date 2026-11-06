import type { Recurrence, Task, TaskWhen } from "@family-hub/contract";

export const emptyTask = {
  title: "",
  date: "",
  time: "",
  endDate: "",
  endTime: "",
  frequency: "",
  until: "",
  recipients: "default",
  visibility: "shared",
  petId: "",
  albumId: "",
  note: "",
};

export type TaskValues = typeof emptyTask;

export function orNull(text: string): string | null {
  return text === "" ? null : text;
}

function orEmpty(text: string | null): string {
  return text ?? "";
}

function whenValuesOf(when: TaskWhen | null) {
  return when === null
    ? { date: "", time: "", endDate: "", endTime: "" }
    : {
        date: when.date,
        time: orEmpty(when.time),
        endDate: orEmpty(when.endDate),
        endTime: orEmpty(when.endTime),
      };
}

function recurrenceValuesOf(recurrence: Recurrence | null) {
  return recurrence === null
    ? { frequency: "", until: "" }
    : { frequency: recurrence.frequency, until: orEmpty(recurrence.until) };
}

export function valuesOf(task: Task): TaskValues {
  return {
    ...whenValuesOf(task.when),
    ...recurrenceValuesOf(task.recurrence),
    title: task.title,
    recipients: Array.isArray(task.recipients) ? "members" : task.recipients,
    visibility: task.visibility,
    petId: orEmpty(task.pet?.id ?? null),
    albumId: orEmpty(task.album?.id ?? null),
    note: orEmpty(task.note),
  };
}
