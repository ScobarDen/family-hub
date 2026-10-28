import { action, atom, computed, reatomBoolean, reatomForm, type Atom } from "@reatom/core";
import { z } from "zod";

import { offsetTitles } from "@family-hub/commands";
import {
  dateOnlyOffsets,
  reminderMaxCount,
  reminderOffset,
  taskChange,
  taskNoteMaxLength,
  taskTitleMaxLength,
  type ReminderOffset,
  type Task,
  type TaskChange,
  type TaskDraft,
} from "@family-hub/contract";

import { reatomEditableRecord, type DraftOpening } from "@/common/form";
import type { ClosingConfirmation, Haptics } from "@/common/telegram";
import type { AvatarMember, Choice } from "@/common/ui";

import type { TasksApi } from "../tasks.api.ts";
import type { TasksModel } from "../tasks.model.ts";
import {
  emptyTask,
  orNull,
  valuesOf,
  valuesOfDraft,
  type TaskValues,
} from "./task-form-values.vm.ts";

type TaskFormDependencies = {
  api: TasksApi;
  tasks: Pick<TasksModel, "keep" | "members" | "pets" | "albums">;
  self: () => string | undefined;
  timeZone: () => string;
  haptics: Pick<Haptics, "success" | "error" | "select">;
  closingConfirmation: ClosingConfirmation;
  onSaved: (task: Task) => void;
  onDraftSaved: (draftId: string) => void;
};

export type TaskDraftOpening = DraftOpening<TaskDraft>;

const schema = z
  .object({
    title: z.string().trim().min(1, "Введите название").max(taskTitleMaxLength, "Слишком длинно"),
    date: z.string(),
    time: z.string(),
    endDate: z.string(),
    endTime: z.string(),
    frequency: z.string(),
    until: z.string(),
    recipients: z.string(),
    visibility: z.string(),
    petId: z.string(),
    albumId: z.string(),
    note: z.string().max(taskNoteMaxLength, `Не длиннее ${taskNoteMaxLength} символов`),
  })
  .superRefine((values, issues) => {
    if (values.endDate !== "" && values.endDate < values.date) {
      issues.addIssue({ code: "custom", path: ["endDate"], message: "Окончание раньше начала" });
    }
  });

// The people picked by chips, which a form's string fields cannot hold.
type People = { assigneeIds: Atom<string[]>; recipientIds: Atom<string[]> };

type Picks = People & { offsets: Atom<ReminderOffset[]> };

function whenOf(values: TaskValues, timeZone: string): TaskChange["when"] {
  if (values.date === "") {
    return null;
  }

  const isTimed = values.time !== "";

  return {
    date: values.date,
    time: orNull(values.time),
    timeZone: isTimed ? timeZone : null,
    endDate: orNull(values.endDate),
    endTime: isTimed ? orNull(values.endTime) : null,
  };
}

// Recurrence and Reminders need a date, minutes and hours before need a time: what cannot apply is
// dropped rather than refused.
function changeOf(values: TaskValues, { picks, timeZone }: { picks: Picks; timeZone: string }) {
  const hasDate = values.date !== "";
  const offsets = picks
    .offsets()
    .filter((offset) => hasDate && (values.time !== "" || dateOnlyOffsets.includes(offset)));

  return taskChange.parse({
    title: values.title,
    note: values.note,
    when: whenOf(values, timeZone),
    recurrence:
      hasDate && values.frequency !== ""
        ? { frequency: values.frequency, until: orNull(values.until) }
        : null,
    assigneeIds: picks.assigneeIds(),
    recipients: values.recipients === "members" ? picks.recipientIds() : values.recipients,
    reminderOffsets: offsets,
    visibility: values.visibility,
    petId: orNull(values.petId),
    albumId: orNull(values.albumId),
  });
}

// A timed Task keeps the zone it was set in; a new one takes the zone of whoever creates it, or of
// the phrase its Command Draft was said in.
function reatomTaskRecord(dependencies: TaskFormDependencies, picks: Picks) {
  return reatomEditableRecord({
    name: "tasks.taskRecord",
    form: (onSubmit) => reatomForm(emptyTask, { name: "tasks.taskForm", schema, onSubmit }),
    failureMessage: "Не получилось сохранить дело. Попробуйте ещё раз.",
    haptics: dependencies.haptics,
    closingConfirmation: dependencies.closingConfirmation,
    valuesOf,
    valuesOfDraft,
    create: async (values, { phrase }) =>
      dependencies.api.create(
        changeOf(values, { picks, timeZone: phrase?.timeZone ?? dependencies.timeZone() }),
      ),
    update: async (task: Task, values) =>
      dependencies.api.update(
        task.id,
        changeOf(values, { picks, timeZone: task.when?.timeZone ?? dependencies.timeZone() }),
      ),
    onSaved: (saved) => {
      dependencies.tasks.keep(saved);
      dependencies.onSaved(saved);
    },
    onDraftSaved: dependencies.onDraftSaved,
  });
}

type TaskRecord = ReturnType<typeof reatomTaskRecord>;

export type PersonChoice = { id: string; member: AvatarMember; isChosen: boolean };

export type OffsetChoice = { offset: ReminderOffset; title: string; isChosen: boolean };

function toggled<Item>(items: Item[], item: Item, max = Number.POSITIVE_INFINITY): Item[] {
  if (items.includes(item)) {
    return items.filter((other) => other !== item);
  }

  return items.length < max ? [...items, item] : items;
}

// A Private Task's people could reveal the surprise, so they are its owner or nobody.
function reatomPeople(dependencies: TaskFormDependencies, { form }: TaskRecord, picks: Picks) {
  function choicesOf(chosen: Atom<string[]>, name: string) {
    return computed((): PersonChoice[] => {
      const isPrivate = form.fields.visibility() === "private";

      return (dependencies.tasks.members.data() ?? [])
        .filter(({ id }) => !isPrivate || id === dependencies.self())
        .map(({ id, name: memberName, profilePicture }) => ({
          id,
          member: { name: memberName, profilePicture },
          isChosen: chosen().includes(id),
        }));
    }, name);
  }

  return {
    assignees: choicesOf(picks.assigneeIds, "tasks.taskForm.assignees"),
    recipientChoices: choicesOf(picks.recipientIds, "tasks.taskForm.recipientChoices"),
    toggleAssignee: action((memberId: string) => {
      dependencies.haptics.select();
      picks.assigneeIds.set(toggled(picks.assigneeIds(), memberId));
    }, "tasks.taskForm.toggleAssignee"),
    toggleRecipient: action((memberId: string) => {
      dependencies.haptics.select();
      picks.recipientIds.set(toggled(picks.recipientIds(), memberId));
    }, "tasks.taskForm.toggleRecipient"),
    chooseVisibility: action((chosen: string) => {
      dependencies.haptics.select();
      form.fields.visibility.set(chosen);

      if (chosen === "private") {
        const self = dependencies.self();

        function ownOnly(ids: string[]): string[] {
          return ids.filter((id) => id === self);
        }

        picks.assigneeIds.set(ownOnly(picks.assigneeIds()));
        picks.recipientIds.set(ownOnly(picks.recipientIds()));
      }
    }, "tasks.taskForm.chooseVisibility"),
  };
}

function chipTitleOf(offset: ReminderOffset): string {
  const title = offsetTitles[offset];

  return title.charAt(0).toUpperCase() + title.slice(1);
}

// No date, no Reminders; a whole day offers only the day-sized offsets.
function reatomOffsets(
  { form }: TaskRecord,
  { chosen, haptics }: { chosen: Atom<ReminderOffset[]>; haptics: Pick<Haptics, "select"> },
) {
  const offsets = computed((): OffsetChoice[] => {
    const isTimed = form.fields.time() !== "";

    return reminderOffset.options
      .filter((offset) => isTimed || dateOnlyOffsets.includes(offset))
      .map((offset) => ({
        offset,
        title: chipTitleOf(offset),
        isChosen: chosen().includes(offset),
      }));
  }, "tasks.taskForm.offsets");
  const hasReminders = computed(
    () => offsets().some(({ isChosen }) => isChosen),
    "tasks.taskForm.hasReminders",
  );

  return {
    offsets,
    hasReminders,
    isPickingRecipients: computed(
      () => hasReminders() && form.fields.recipients() === "members",
      "tasks.taskForm.isPickingRecipients",
    ),
    toggleOffset: action((offset: ReminderOffset) => {
      haptics.select();
      chosen.set(toggled(chosen(), offset, reminderMaxCount));
    }, "tasks.taskForm.toggleOffset"),
  };
}

// Only the «none» choice left means there is nothing to choose, so the field stays hidden.
function reatomLinks({ tasks }: TaskFormDependencies) {
  const pets = computed(
    (): Choice[] => [
      { value: "", title: "Без питомца" },
      ...(tasks.pets.data() ?? [])
        .filter(({ archivedAt }) => archivedAt === null)
        .map(({ id, name }) => ({ value: id, title: name })),
    ],
    "tasks.taskForm.pets",
  );
  const albums = computed(
    (): Choice[] => [
      { value: "", title: "Без альбома" },
      ...(tasks.albums.data() ?? [])
        .filter(({ kind }) => kind === "album")
        .map(({ id, title }) => ({ value: id, title })),
    ],
    "tasks.taskForm.albums",
  );

  return {
    pets,
    hasPetChoice: computed(() => pets().length > 1, "tasks.taskForm.hasPetChoice"),
    albums,
    hasAlbumChoice: computed(() => albums().length > 1, "tasks.taskForm.hasAlbumChoice"),
  };
}

function reatomFlags({ form, edited }: TaskRecord, isExpanded: Atom<boolean>) {
  return {
    hasDate: computed(() => form.fields.date() !== "", "tasks.taskForm.hasDate"),
    isTimed: computed(() => form.fields.time() !== "", "tasks.taskForm.isTimed"),
    isRecurring: computed(() => form.fields.frequency() !== "", "tasks.taskForm.isRecurring"),
    isExpanded,
    // A Shared Task never turns Private, so editing one offers no choice.
    canChooseVisibility: computed(
      () => edited()?.visibility !== "shared",
      "tasks.taskForm.canChooseVisibility",
    ),
    // A weekly chore would need its checklist reset, so a Task with Subtasks never repeats.
    canRepeat: computed(() => (edited()?.subtasks.length ?? 0) === 0, "tasks.taskForm.canRepeat"),
  };
}

type Chosen = { assigneeIds: string[]; recipientIds: string[]; offsets: ReminderOffset[] };

function pick(picks: Picks, { assigneeIds, recipientIds, offsets }: Chosen): void {
  picks.assigneeIds.set(assigneeIds);
  picks.recipientIds.set(recipientIds);
  picks.offsets.set(offsets);
}

function reatomStarts(
  record: TaskRecord,
  { picks, isExpanded }: { picks: Picks; isExpanded: ReturnType<typeof reatomBoolean> },
) {
  return {
    startCreating: action(({ date = "", petId = "" }: { date?: string; petId?: string } = {}) => {
      pick(picks, { assigneeIds: [], recipientIds: [], offsets: [] });
      isExpanded.set(petId !== "");
      record.startCreating({ ...emptyTask, date, petId });
    }, "tasks.taskForm.startCreating"),
    startFromDraft: action((opening: TaskDraftOpening) => {
      pick(picks, {
        assigneeIds: [],
        recipientIds: opening.draft.recipientIds ?? [],
        offsets: opening.draft.reminderOffsets,
      });
      isExpanded.set(true);
      record.startFromDraft(opening);
    }, "tasks.taskForm.startFromDraft"),
    startEditing: action((task: Task) => {
      pick(picks, {
        assigneeIds: task.assignees.map(({ id }) => id),
        recipientIds: Array.isArray(task.recipients) ? task.recipients.map(({ id }) => id) : [],
        offsets: task.reminderOffsets,
      });
      isExpanded.set(true);
      record.startEditing(task);
    }, "tasks.taskForm.startEditing"),
  };
}

export function reatomTaskForm(dependencies: TaskFormDependencies) {
  const picks: Picks = {
    assigneeIds: atom<string[]>([], "tasks.taskForm.assigneeIds"),
    recipientIds: atom<string[]>([], "tasks.taskForm.recipientIds"),
    offsets: atom<ReminderOffset[]>([], "tasks.taskForm.chosenOffsets"),
  };
  const isExpanded = reatomBoolean(false, "tasks.taskForm.isExpanded");
  const record = reatomTaskRecord(dependencies, picks);

  return {
    ...record,
    ...reatomFlags(record, isExpanded),
    ...reatomPeople(dependencies, record, picks),
    ...reatomOffsets(record, { chosen: picks.offsets, haptics: dependencies.haptics }),
    ...reatomLinks(dependencies),
    ...reatomStarts(record, { picks, isExpanded }),
    expand: action(() => {
      isExpanded.set(true);
    }, "tasks.taskForm.expand"),
  };
}

export type TaskFormModel = ReturnType<typeof reatomTaskForm>;
