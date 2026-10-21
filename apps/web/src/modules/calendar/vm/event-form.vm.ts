import { action, atom, computed, noop, reatomForm, wrap, type Atom } from "@reatom/core";
import { z } from "zod";

import { eventChange, type CalendarEvent, type EventChange } from "@family-hub/contract";

import { fillForm, reatomSubmitFailure } from "@/common/form";

import type { CalendarApi } from "../calendar.api.ts";
import type { CalendarData } from "../calendar.model.ts";

type EventFormDependencies = {
  api: CalendarApi;
  data: Pick<CalendarData, "keep">;
  timeZone: () => string;
  onSaved: (event: CalendarEvent) => void;
};

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

// A timed Event keeps the zone it was set in; a new one takes the zone of whoever creates it.
function changeOf(values: EventValues, timeZone: string): EventChange {
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

function repeatValuesOf({ recurrence }: CalendarEvent) {
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

type EventForm = ReturnType<typeof reatomForm<EventValues>>;

function reatomFlags(form: EventForm, edited: Atom<CalendarEvent | undefined>) {
  return {
    isCreating: computed(() => edited() === undefined, "calendar.form.isCreating"),
    isTimed: computed(() => form.fields.timing() === "timed", "calendar.form.isTimed"),
    isRecurring: computed(() => form.fields.frequency() !== "", "calendar.form.isRecurring"),
    // A Shared Event never turns Private, so editing one offers no choice.
    canChooseVisibility: computed(
      () => edited()?.visibility !== "shared",
      "calendar.form.canChooseVisibility",
    ),
    isSaving: computed(() => !form.submit.ready(), "calendar.form.isSaving"),
    failure: reatomSubmitFailure(form, {
      message: "Не получилось сохранить событие. Попробуйте ещё раз.",
      name: "calendar.form.failure",
    }),
  };
}

export function reatomEventForm(dependencies: EventFormDependencies) {
  const edited = atom<CalendarEvent | undefined>(undefined, "calendar.form.edited");
  const form = reatomForm(emptyEvent, {
    name: "calendar.form",
    schema,
    onSubmit: async (values: EventValues) => {
      const event = edited();
      const change = changeOf(values, event?.start.timeZone ?? dependencies.timeZone());
      const saved = await wrap(
        event === undefined
          ? dependencies.api.create(change)
          : dependencies.api.update(event.id, change),
      );

      dependencies.data.keep(saved);
      dependencies.onSaved(saved);
    },
  });

  return {
    form,
    ...reatomFlags(form, edited),
    startCreating: action((date: string) => {
      edited.set(undefined);
      fillForm(form, { ...emptyEvent, date });
    }, "calendar.form.startCreating"),
    startEditing: action((event: CalendarEvent) => {
      edited.set(event);
      fillForm(form, valuesOf(event));
    }, "calendar.form.startEditing"),
    save: action(() => {
      form.submit().catch(noop);
    }, "calendar.form.save"),
  };
}

export type EventFormModel = ReturnType<typeof reatomEventForm>;
