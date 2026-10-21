import { action, atom, computed, noop, reatomForm, wrap, type Atom } from "@reatom/core";
import { z } from "zod";

import {
  reminderChange,
  type ReminderDraft,
  type Reminder,
  type ReminderChange,
} from "@family-hub/contract";

import { fillForm, reatomSubmitFailure } from "@/common/form";
import type { PopupParams } from "@/common/telegram";

import type { CalendarApi } from "../calendar.api.ts";
import type { CalendarData } from "../calendar.model.ts";

type ReminderFormDependencies = {
  api: CalendarApi;
  data: Pick<CalendarData, "keepReminder" | "dropReminder" | "members">;
  timeZone: () => string;
  self: () => string | undefined;
  telegram: { showPopup: (params: PopupParams) => Promise<string | undefined> };
  onClosed: () => void;
  // A Reminder saved from a Command Draft settles that draft.
  onDraftSaved?: (draftId: string) => void;
};

export type ReminderDraftOpening = { draftId: string; draft: ReminderDraft };

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

// A Reminder fires at its time in the zone it was set in; a new one takes its creator's zone.
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

type Editing = Atom<Reminder | undefined>;

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
    const choice = await wrap(
      dependencies.telegram.showPopup({
        title: "Удалить напоминание?",
        message: "Оно больше не придёт никому.",
        buttons: [
          { id: "delete", type: "destructive", text: "Удалить" },
          { id: "cancel", type: "cancel" },
        ],
      }),
    );

    if (reminder !== undefined && choice === "delete") {
      await wrap(dependencies.api.removeReminder(reminder.id));
      dependencies.data.dropReminder(reminder.id);
      dependencies.onClosed();
    }
  }, "calendar.reminderForm.remove");
}

type ReminderForm = ReturnType<typeof reatomForm<ReminderValues>>;

function reatomFlags(form: ReminderForm, edited: Editing) {
  return {
    isCreating: computed(() => edited() === undefined, "calendar.reminderForm.isCreating"),
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
    isSaving: computed(() => !form.submit.ready(), "calendar.reminderForm.isSaving"),
    failure: reatomSubmitFailure(form, {
      message: "Не получилось сохранить напоминание. Попробуйте ещё раз.",
      name: "calendar.reminderForm.failure",
    }),
  };
}

function reatomStarts(
  form: ReminderForm,
  {
    edited,
    chosen,
    fromDraft,
  }: { edited: Editing; chosen: Atom<string[]>; fromDraft: Atom<string | undefined> },
) {
  return {
    startCreating: action((date: string) => {
      edited.set(undefined);
      chosen.set([]);
      fromDraft.set(undefined);
      fillForm(form, { ...emptyReminder, date });
    }, "calendar.reminderForm.startCreating"),
    startFromDraft: action(({ draftId, draft }: ReminderDraftOpening) => {
      edited.set(undefined);
      chosen.set(draft.visibility === "private" ? [] : (draft.recipientIds ?? []));
      fromDraft.set(draftId);
      fillForm(form, valuesOfDraft(draft));
    }, "calendar.reminderForm.startFromDraft"),
    startEditing: action((reminder: Reminder) => {
      edited.set(reminder);
      fromDraft.set(undefined);
      chosen.set(reminder.isForEveryone ? [] : reminder.recipients.map(({ id }) => id));
      fillForm(form, valuesOf(reminder));
    }, "calendar.reminderForm.startEditing"),
  };
}

function settleDraft(
  { onDraftSaved }: ReminderFormDependencies,
  fromDraft: Atom<string | undefined>,
): void {
  const draftId = fromDraft();

  if (draftId !== undefined) {
    fromDraft.set(undefined);
    onDraftSaved?.(draftId);
  }
}

export function reatomReminderForm(dependencies: ReminderFormDependencies) {
  const edited: Editing = atom<Reminder | undefined>(undefined, "calendar.reminderForm.edited");
  const chosen = atom<string[]>([], "calendar.reminderForm.chosen");
  const fromDraft = atom<string | undefined>(undefined, "calendar.reminderForm.fromDraft");
  const form = reatomForm(emptyReminder, {
    name: "calendar.reminderForm",
    schema,
    onSubmit: async (values: ReminderValues) => {
      const reminder = edited();
      const change = changeOf(values, {
        timeZone: reminder?.start.timeZone ?? dependencies.timeZone(),
        recipientIds: chosen().length === 0 ? null : chosen(),
      });
      const saved = await wrap(
        reminder === undefined
          ? dependencies.api.createReminder(change)
          : dependencies.api.updateReminder(reminder.id, change),
      );

      dependencies.data.keepReminder(saved);
      settleDraft(dependencies, fromDraft);
      dependencies.onClosed();
    },
  });
  const remove = reatomRemove(dependencies, edited);

  return {
    form,
    ...reatomRecipients(dependencies, chosen),
    ...reatomFlags(form, edited),

    ...reatomStarts(form, { edited, chosen, fromDraft }),
    save: action(() => {
      form.submit().catch(noop);
    }, "calendar.reminderForm.save"),
    removeReminder: action(() => {
      remove().catch(noop);
    }, "calendar.reminderForm.removeReminder"),
  };
}

export type ReminderFormModel = ReturnType<typeof reatomReminderForm>;
