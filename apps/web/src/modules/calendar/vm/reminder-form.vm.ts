import { action, atom, type Atom, computed, reatomForm, wrap } from "@reatom/core";
import { z } from "zod";

import {
  reminderChange,
  type ReminderDraft,
  type Reminder,
  type ReminderChange,
} from "@family-hub/contract";

import { reatomEditableRecord, type DraftOpening } from "@/common/form";
import { detached } from "@/common/state";
import { type Dialogs, isConfirmed } from "@/common/telegram";

import type { CalendarApi } from "../calendar.api.ts";
import type { CalendarData } from "../calendar.model.ts";

type ReminderFormDependencies = {
  api: CalendarApi;
  data: Pick<CalendarData, "keepReminder" | "dropReminder" | "members">;
  timeZone: () => string;
  self: () => string | undefined;
  telegram: Pick<Dialogs, "showPopup">;
  onClosed: () => void;
  // A Reminder saved from a Command Draft settles that draft.
  onDraftSaved: (draftId: string) => void;
};

export type ReminderDraftOpening = DraftOpening<ReminderDraft>;

export type RecipientChoice = { id: string; name: string; isChosen: boolean };

const emptyReminder = {
  text: "",
  date: "",
  time: "09:00",
  frequency: "",
  until: "",
  visibility: "shared",
};

type ReminderValues = typeof emptyReminder;

const schema = z.object({
  text: z.string().trim().min(1, "О чём напомнить?"),
  date: z.string().min(1, "Укажите дату"),
  time: z.string().min(1, "Укажите время"),
  frequency: z.string(),
  until: z.string(),
  visibility: z.string(),
});

function changeOf(
  values: ReminderValues,
  { timeZone, recipientIds }: { timeZone: string; recipientIds: string[] | null },
): ReminderChange {
  return reminderChange.parse({
    text: values.text,
    start: { date: values.date, time: values.time, timeZone },
    recurrence:
      values.frequency === ""
        ? null
        : { frequency: values.frequency, until: values.until === "" ? null : values.until },
    visibility: values.visibility,
    recipientIds: values.visibility === "private" ? null : recipientIds,
  });
}

function valuesOf({ text, start, recurrence, visibility }: Reminder): ReminderValues {
  return {
    text,
    date: start.date,
    time: start.time,
    frequency: recurrence?.frequency ?? "",
    until: recurrence?.until ?? "",
    visibility,
  };
}

function valuesOfDraft({
  text,
  date,
  time,
  recurrence,
  visibility,
}: ReminderDraft): ReminderValues {
  return {
    text: text ?? "",
    date: date ?? "",
    time: time ?? "",
    frequency: recurrence?.frequency ?? "",
    until: recurrence?.until ?? "",
    visibility,
  };
}

type Editing = () => Reminder | undefined;

// No choice means everyone in the Family.
function reatomRecipients(dependencies: ReminderFormDependencies, chosen: Atom<string[]>) {
  return {
    recipients: computed(
      (): RecipientChoice[] =>
        (dependencies.data.members.data() ?? []).map(({ id, name }) => ({
          id,
          name,
          isChosen: chosen().includes(id),
        })),
      "calendar.reminderForm.recipients",
    ),
    isForEveryone: computed(() => chosen().length === 0, "calendar.reminderForm.isForEveryone"),
    toggleRecipient: action((memberId: string) => {
      chosen.set(
        chosen().includes(memberId)
          ? chosen().filter((id) => id !== memberId)
          : [...chosen(), memberId],
      );
    }, "calendar.reminderForm.toggleRecipient"),
    chooseEveryone: action(() => {
      chosen.set([]);
    }, "calendar.reminderForm.chooseEveryone"),
  };
}

function reatomRemove(dependencies: ReminderFormDependencies, edited: Editing) {
  return action(async () => {
    const reminder = edited();
    const isSure = await wrap(
      isConfirmed(dependencies.telegram, {
        title: "Удалить напоминание?",
        message: "Оно больше не придёт никому.",
        button: "Удалить",
      }),
    );

    if (reminder !== undefined && isSure) {
      await wrap(dependencies.api.removeReminder(reminder.id));
      dependencies.data.dropReminder(reminder.id);
      dependencies.onClosed();
    }
  }, "calendar.reminderForm.remove");
}

type ReminderRecord = ReturnType<typeof reatomReminderRecord>;

function reatomFlags({ form, edited }: ReminderRecord) {
  return {
    isPrivate: computed(
      () => form.fields.visibility() === "private",
      "calendar.reminderForm.isPrivate",
    ),
    isRecurring: computed(
      () => form.fields.frequency() !== "",
      "calendar.reminderForm.isRecurring",
    ),
    canDelete: computed(() => edited()?.isOwn === true, "calendar.reminderForm.canDelete"),
    canChooseVisibility: computed(
      () => edited()?.visibility !== "shared",
      "calendar.reminderForm.canChooseVisibility",
    ),
  };
}

function reatomStarts(record: ReminderRecord, chosen: Atom<string[]>) {
  return {
    startCreating: action((date: string) => {
      chosen.set([]);
      record.startCreating({ ...emptyReminder, date });
    }, "calendar.reminderForm.startCreating"),
    startFromDraft: action((opening: ReminderDraftOpening) => {
      const { visibility, recipientIds } = opening.draft;

      chosen.set(visibility === "private" ? [] : (recipientIds ?? []));
      record.startFromDraft(opening);
    }, "calendar.reminderForm.startFromDraft"),
    startEditing: action((reminder: Reminder) => {
      chosen.set(reminder.isForEveryone ? [] : reminder.recipients.map(({ id }) => id));
      record.startEditing(reminder);
    }, "calendar.reminderForm.startEditing"),
  };
}

// A Reminder fires at its time in the zone it was set in; a new one takes its creator's zone,
// or that of the phrase its Command Draft was said in.
function reatomReminderRecord(dependencies: ReminderFormDependencies, chosen: Atom<string[]>) {
  function changeFor(values: ReminderValues, timeZone: string): ReminderChange {
    return changeOf(values, {
      timeZone,
      recipientIds: chosen().length === 0 ? null : chosen(),
    });
  }

  return reatomEditableRecord({
    name: "calendar.reminderRecord",
    form: (onSubmit) =>
      reatomForm(emptyReminder, { name: "calendar.reminderForm", schema, onSubmit }),
    failureMessage: "Не получилось сохранить напоминание. Попробуйте ещё раз.",
    valuesOf,
    valuesOfDraft,
    create: async (values, { phrase }) =>
      dependencies.api.createReminder(
        changeFor(values, phrase?.timeZone ?? dependencies.timeZone()),
      ),
    update: async (reminder: Reminder, values) =>
      dependencies.api.updateReminder(reminder.id, changeFor(values, reminder.start.timeZone)),
    onSaved: (saved) => {
      dependencies.data.keepReminder(saved);
      dependencies.onClosed();
    },
    onDraftSaved: dependencies.onDraftSaved,
  });
}

export function reatomReminderForm(dependencies: ReminderFormDependencies) {
  const chosen = atom<string[]>([], "calendar.reminderForm.chosen");
  const record = reatomReminderRecord(dependencies, chosen);
  const remove = reatomRemove(dependencies, record.edited);

  return {
    ...record,
    ...reatomRecipients(dependencies, chosen),
    ...reatomFlags(record),
    ...reatomStarts(record, chosen),
    removeReminder: detached(remove, "calendar.reminderForm.removeReminder"),
  };
}

export type ReminderFormModel = ReturnType<typeof reatomReminderForm>;
