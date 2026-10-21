import { action, atom, computed, reatomForm, type Atom } from "@reatom/core";
import { z } from "zod";

import { offsetTitles } from "@family-hub/commands";
import {
  eventChange,
  eventReminderMaxCount,
  eventReminderOffset,
  type CalendarEvent,
  type EventChange,
  type EventDraft,
  type EventReminderOffset,
} from "@family-hub/contract";

import { reatomEditableRecord } from "@/common/form";

import type { CalendarApi } from "../calendar.api.ts";
import type { CalendarData } from "../calendar.model.ts";

type EventFormDependencies = {
  api: CalendarApi;
  data: Pick<CalendarData, "keep">;
  timeZone: () => string;
  onSaved: (event: CalendarEvent) => void;
  // An Event saved from a Command Draft settles that draft.
  onDraftSaved?: (draftId: string) => void;
};

export type EventDraftOpening = { draftId: string; draft: EventDraft };

const emptyEvent = {
  title: "",
  timing: "all-day",
  date: "",
  time: "",
  endDate: "",
  endTime: "",
  frequency: "",
  until: "",
  visibility: "shared",
  note: "",
};

type EventValues = typeof emptyEvent;

const schema = z
  .object({
    title: z.string().trim().min(1, "Введите название"),
    timing: z.string(),
    date: z.string().min(1, "Укажите дату"),
    time: z.string(),
    endDate: z.string(),
    endTime: z.string(),
    frequency: z.string(),
    until: z.string(),
    visibility: z.string(),
    note: z.string(),
  })
  .superRefine((values, issues) => {
    if (values.timing === "timed" && values.time === "") {
      issues.addIssue({ code: "custom", path: ["time"], message: "Укажите время" });
    }

    if (values.endDate !== "" && values.endDate < values.date) {
      issues.addIssue({ code: "custom", path: ["endDate"], message: "Окончание раньше начала" });
    }
  });

function orNull(text: string): string | null {
  return text === "" ? null : text;
}

function changeOf(
  values: EventValues,
  { timeZone, reminderOffsets }: { timeZone: string; reminderOffsets: EventReminderOffset[] },
): EventChange {
  const isTimed = values.timing === "timed";

  return eventChange.parse({
    title: values.title,
    note: values.note,
    start: {
      date: values.date,
      time: isTimed ? values.time : null,
      timeZone: isTimed ? timeZone : null,
    },
    end:
      values.endDate === ""
        ? null
        : { date: values.endDate, time: isTimed ? orNull(values.endTime) : null },
    recurrence:
      values.frequency === "" ? null : { frequency: values.frequency, until: orNull(values.until) },
    visibility: values.visibility,
    reminderOffsets,
  });
}

function whenValuesOf({ start, end }: CalendarEvent) {
  return {
    timing: start.time === null ? "all-day" : "timed",
    date: start.date,
    time: start.time ?? "",
    endDate: end?.date ?? "",
    endTime: end?.time ?? "",
  };
}

function repeatValuesOf({ recurrence }: Pick<CalendarEvent, "recurrence">) {
  return recurrence === null
    ? { frequency: "", until: "" }
    : { frequency: recurrence.frequency, until: recurrence.until ?? "" };
}

function valuesOf(event: CalendarEvent): EventValues {
  return {
    title: event.title,
    ...whenValuesOf(event),
    ...repeatValuesOf(event),
    visibility: event.visibility,
    note: event.note ?? "",
  };
}

function draftWhenValuesOf({ date, time, endDate, endTime }: EventDraft) {
  return {
    timing: time === null ? "all-day" : "timed",
    date: date ?? "",
    time: time ?? "",
    endDate: endDate ?? "",
    endTime: endTime ?? "",
  };
}

function valuesOfDraft(draft: EventDraft): EventValues {
  return {
    title: draft.title ?? "",
    ...draftWhenValuesOf(draft),
    ...repeatValuesOf(draft),
    visibility: draft.visibility,
    note: draft.note ?? "",
  };
}

export type OffsetChoice = { offset: EventReminderOffset; title: string; isChosen: boolean };

function chipTitleOf(offset: EventReminderOffset): string {
  const title = offsetTitles[offset];

  return title.charAt(0).toUpperCase() + title.slice(1);
}

// An all-day Event has no start time, so only the day-sized offsets apply to it.
const allDayOffsets = new Set<EventReminderOffset>(["at-start", "1d", "1w"]);

function offsetsFor(isTimed: boolean): EventReminderOffset[] {
  return eventReminderOffset.options.filter((offset) => isTimed || allDayOffsets.has(offset));
}

function applicableOffsets(chosen: EventReminderOffset[], timing: string) {
  const offsets = offsetsFor(timing === "timed");

  return chosen.filter((offset) => offsets.includes(offset));
}

function reatomOffsets(form: EventForm, chosen: Atom<EventReminderOffset[]>) {
  return {
    offsets: computed(
      (): OffsetChoice[] =>
        offsetsFor(form.fields.timing() === "timed").map((offset) => ({
          offset,
          title: chipTitleOf(offset),
          isChosen: chosen().includes(offset),
        })),
      "calendar.form.offsets",
    ),
    toggleOffset: action((offset: EventReminderOffset) => {
      const current = chosen();

      if (current.includes(offset)) {
        chosen.set(current.filter((other) => other !== offset));
      } else if (current.length < eventReminderMaxCount) {
        chosen.set([...current, offset]);
      }
    }, "calendar.form.toggleOffset"),
  };
}

type EventRecord = ReturnType<typeof reatomEventRecord>;

type EventForm = EventRecord["form"];

function reatomFlags({ form, edited }: EventRecord) {
  return {
    isTimed: computed(() => form.fields.timing() === "timed", "calendar.form.isTimed"),
    isRecurring: computed(() => form.fields.frequency() !== "", "calendar.form.isRecurring"),
    // A Shared Event never turns Private, so editing one offers no choice.
    canChooseVisibility: computed(
      () => edited()?.visibility !== "shared",
      "calendar.form.canChooseVisibility",
    ),
  };
}

function reatomStarts(record: EventRecord, chosenOffsets: Atom<EventReminderOffset[]>) {
  return {
    startCreating: action((date: string) => {
      chosenOffsets.set([]);
      record.startCreating({ ...emptyEvent, date });
    }, "calendar.form.startCreating"),
    startFromDraft: action((opening: EventDraftOpening) => {
      chosenOffsets.set(opening.draft.reminderOffsets);
      record.startFromDraft(opening);
    }, "calendar.form.startFromDraft"),
    startEditing: action((event: CalendarEvent) => {
      chosenOffsets.set(event.reminderOffsets);
      record.startEditing(event);
    }, "calendar.form.startEditing"),
  };
}

// A timed Event keeps the zone it was set in; a new one takes the zone of whoever creates it.
function reatomEventRecord(
  dependencies: EventFormDependencies,
  chosenOffsets: Atom<EventReminderOffset[]>,
) {
  function changeFor(values: EventValues, timeZone: string): EventChange {
    return changeOf(values, {
      timeZone,
      reminderOffsets: applicableOffsets(chosenOffsets(), values.timing),
    });
  }

  return reatomEditableRecord({
    name: "calendar.eventRecord",
    form: (onSubmit) => reatomForm(emptyEvent, { name: "calendar.form", schema, onSubmit }),
    failureMessage: "Не получилось сохранить событие. Попробуйте ещё раз.",
    valuesOf,
    valuesOfDraft,
    create: async (values) => dependencies.api.create(changeFor(values, dependencies.timeZone())),
    update: async (event: CalendarEvent, values) =>
      dependencies.api.update(
        event.id,
        changeFor(values, event.start.timeZone ?? dependencies.timeZone()),
      ),
    onSaved: (saved) => {
      dependencies.data.keep(saved);
      dependencies.onSaved(saved);
    },
    onDraftSaved: dependencies.onDraftSaved,
  });
}

export function reatomEventForm(dependencies: EventFormDependencies) {
  const chosenOffsets = atom<EventReminderOffset[]>([], "calendar.form.chosenOffsets");
  const record = reatomEventRecord(dependencies, chosenOffsets);

  return {
    ...record,
    ...reatomFlags(record),
    ...reatomOffsets(record.form, chosenOffsets),
    ...reatomStarts(record, chosenOffsets),
  };
}

export type EventFormModel = ReturnType<typeof reatomEventForm>;
