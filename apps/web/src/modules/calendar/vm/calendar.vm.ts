import { action, atom, computed, type Atom } from "@reatom/core";

import type { PopupParams } from "@/common/telegram";

import type { CalendarApi } from "../calendar.api.ts";
import {
  daysAfter,
  itemsIn,
  monthGrid,
  monthRangeOf,
  monthTitle,
  planDeadlines,
  shiftMonth,
  type CalendarItem,
  type DayCell,
} from "../calendar.lib.ts";
import { reatomCalendarData, type CalendarData } from "../calendar.model.ts";
import { reatomEventDetails, type OpenedOccurrence } from "./event-details.vm.ts";
import { reatomEventForm, type EventDraftOpening } from "./event-form.vm.ts";
import { reatomReminderForm, type ReminderDraftOpening } from "./reminder-form.vm.ts";

export type CalendarScreen =
  | { kind: "calendar" }
  | { kind: "event" }
  | { kind: "event-form" }
  | { kind: "reminder-form" };

type CalendarDependencies = {
  api: CalendarApi;
  today: () => string;
  timeZone: () => string;
  telegram: { showPopup: (params: PopupParams) => Promise<string | undefined> };
  onOpenPet: (petId: string) => void;
  onOpenPlan: (planId: string) => void;
  self: () => string | undefined;
  onDraftSaved?: (draftId: string) => void;
};

const upcomingDays = 30;

type Navigation = {
  screen: Atom<CalendarScreen["kind"]>;
  month: Atom<string>;
  selected: Atom<string>;
  opened: Atom<OpenedOccurrence | undefined>;
};

function reatomItems(data: CalendarData, { timeZone, today }: CalendarDependencies) {
  return (range: { from: string; to: string }) =>
    itemsIn(
      {
        events: data.events.data() ?? [],
        reminders: data.reminders.data() ?? [],
        pets: data.pets.data() ?? [],
        dues: data.dues.data() ?? [],
        plans: data.plans.data() ?? [],
      },
      { range, timeZone: timeZone(), today: today() },
    );
}

// «Ближайшее» leads with the Plan deadlines already missed, so they are not lost behind today.
function overdueDeadlines(data: CalendarData, today: string): CalendarItem[] {
  return planDeadlines(data.plans.data() ?? [], today).filter(({ date }) => date < today);
}

function reatomViews(
  { dependencies: { today }, data }: { dependencies: CalendarDependencies; data: CalendarData },
  { month, selected }: Navigation,
  itemsOf: ReturnType<typeof reatomItems>,
) {
  const monthItems = computed(() => itemsOf(monthRangeOf(month())), "calendar.monthItems");

  return {
    monthTitle: computed(() => monthTitle(month()), "calendar.monthTitle"),
    grid: computed(
      (): DayCell[] => monthGrid(month(), { today: today(), items: monthItems() }),
      "calendar.grid",
    ),
    today: computed(() => today(), "calendar.today"),
    selected: computed(() => selected(), "calendar.selectedDate"),
    dayItems: computed(
      (): CalendarItem[] => monthItems().filter(({ date }) => date === selected()),
      "calendar.dayItems",
    ),
    upcoming: computed(
      (): CalendarItem[] => [
        ...overdueDeadlines(data, today()),
        ...itemsOf({ from: today(), to: daysAfter(today(), upcomingDays) }),
      ],
      "calendar.upcoming",
    ),
  };
}

type Parts = {
  data: CalendarData;
  form: ReturnType<typeof reatomEventForm>;
  reminderForm: ReturnType<typeof reatomReminderForm>;
  details: ReturnType<typeof reatomEventDetails>;
};

type Sources = { dependencies: CalendarDependencies; navigation: Navigation; parts: Parts };

function openReminder({ navigation, parts }: Sources, reminderId: string): void {
  const reminder = parts.data.reminders.data()?.find(({ id }) => id === reminderId);

  if (reminder !== undefined) {
    parts.reminderForm.startEditing(reminder);
    navigation.screen.set("reminder-form");
  }
}

function openItemWith(sources: Sources, item: CalendarItem): void {
  const { dependencies, navigation } = sources;
  const { screen, opened } = navigation;

  if (item.kind === "event") {
    opened.set({ eventId: item.eventId, occurrence: item.occurrence });
    screen.set("event");

    return;
  }

  if (item.kind === "plan") {
    dependencies.onOpenPlan(item.planId);

    return;
  }

  if (item.kind === "reminder") {
    openReminder(sources, item.reminderId);
  } else {
    dependencies.onOpenPet(item.petId);
  }
}

function reatomMoves(dependencies: CalendarDependencies, navigation: Navigation, parts: Parts) {
  const { screen, month, selected, opened } = navigation;
  const { form, reminderForm } = parts;

  return {
    previousMonth: action(() => {
      month.set(shiftMonth(month(), -1));
    }, "calendar.previousMonth"),
    nextMonth: action(() => {
      month.set(shiftMonth(month(), 1));
    }, "calendar.nextMonth"),
    select: action((date: string) => {
      selected.set(date);
    }, "calendar.select"),
    openItem: action((item: CalendarItem) => {
      openItemWith({ dependencies, navigation, parts }, item);
    }, "calendar.openItem"),
    // A deep link names the Event, not an Occurrence, so it opens on the series' first date.
    openEvent: action((eventId: string) => {
      opened.set({ eventId, occurrence: undefined });
      screen.set("event");
    }, "calendar.openEvent"),
    add: action(() => {
      form.startCreating(selected());
      screen.set("event-form");
    }, "calendar.add"),
    addReminder: action(() => {
      reminderForm.startCreating(selected());
      screen.set("reminder-form");
    }, "calendar.addReminder"),
    back: action(() => {
      screen.set(screen() === "event-form" && opened() !== undefined ? "event" : "calendar");
    }, "calendar.back"),
  };
}

// «Изменить» on a Command Draft lands in the ordinary form, filled in from the draft.
function reatomDraftOpenings({ screen, opened }: Navigation, { form, reminderForm }: Parts) {
  return {
    openReminderDraft: action((opening: ReminderDraftOpening) => {
      reminderForm.startFromDraft(opening);
      screen.set("reminder-form");
    }, "calendar.openReminderDraft"),
    openEventDraft: action((opening: EventDraftOpening) => {
      opened.set(undefined);
      form.startFromDraft(opening);
      screen.set("event-form");
    }, "calendar.openEventDraft"),
  };
}

function reatomTitle(screen: Atom<CalendarScreen["kind"]>, { form, reminderForm, details }: Parts) {
  return computed(() => {
    const kind = screen();

    if (kind === "event-form") {
      return form.isCreating() ? "Новое событие" : "Событие";
    }

    if (kind === "reminder-form") {
      return reminderForm.isCreating() ? "Новое напоминание" : "Напоминание";
    }

    return kind === "event" ? (details.details()?.title ?? "Событие") : "Календарь";
  }, "calendar.title");
}

function editOpened(screen: Atom<CalendarScreen["kind"]>, { form, details }: Parts): void {
  const event = details.event();

  if (event !== undefined) {
    form.startEditing(event);
    screen.set("event-form");
  }
}

function reatomParts(
  dependencies: CalendarDependencies,
  { data, navigation }: { data: CalendarData; navigation: Navigation },
): Parts {
  const { screen, opened } = navigation;

  return {
    data,
    form: reatomEventForm({
      ...dependencies,
      data,
      onSaved: (saved) => {
        opened.set({ eventId: saved.id, occurrence: saved.start.date });
        screen.set("event");
      },
    }),
    reminderForm: reatomReminderForm({
      ...dependencies,
      data,
      onClosed: () => {
        screen.set("calendar");
      },
    }),
    details: reatomEventDetails({
      ...dependencies,
      data,
      opened,
      onClosed: () => {
        opened.set(undefined);
        screen.set("calendar");
      },
    }),
  };
}

export function reatomCalendar(dependencies: CalendarDependencies) {
  const data = reatomCalendarData(dependencies);
  const navigation: Navigation = {
    screen: atom<CalendarScreen["kind"]>("calendar", "calendar.screenKind"),
    month: atom(dependencies.today().slice(0, "YYYY-MM".length), "calendar.month"),
    selected: atom(dependencies.today(), "calendar.selected"),
    opened: atom<OpenedOccurrence | undefined>(undefined, "calendar.opened"),
  };
  const { screen } = navigation;
  const parts = reatomParts(dependencies, { data, navigation });

  return {
    screen: computed((): CalendarScreen => ({ kind: screen() }), "calendar.screen"),
    title: reatomTitle(screen, parts),
    canGoBack: computed(() => screen() !== "calendar", "calendar.canGoBack"),
    form: parts.form,
    reminderForm: parts.reminderForm,
    details: parts.details,
    ...reatomViews({ dependencies, data }, navigation, reatomItems(data, dependencies)),
    ...reatomMoves(dependencies, navigation, parts),
    ...reatomDraftOpenings(navigation, parts),
    edit: action(() => {
      editOpened(screen, parts);
    }, "calendar.edit"),
  };
}

export type CalendarModel = ReturnType<typeof reatomCalendar>;
