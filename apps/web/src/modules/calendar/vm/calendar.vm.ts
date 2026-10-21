import { action, atom, computed, type Atom } from "@reatom/core";

import type { PopupParams } from "@/common/telegram";

import type { CalendarApi } from "../calendar.api.ts";
import {
  daysAfter,
  itemsIn,
  monthGrid,
  monthRangeOf,
  monthTitle,
  shiftMonth,
  type CalendarItem,
  type DayCell,
} from "../calendar.lib.ts";
import { reatomCalendarData, type CalendarData } from "../calendar.model.ts";
import { reatomEventDetails, type OpenedOccurrence } from "./event-details.vm.ts";
import { reatomEventForm } from "./event-form.vm.ts";

export type CalendarScreen = { kind: "calendar" } | { kind: "event" } | { kind: "event-form" };

type CalendarDependencies = {
  api: CalendarApi;
  today: () => string;
  timeZone: () => string;
  telegram: { showPopup: (params: PopupParams) => Promise<string | undefined> };
  onOpenPet: (petId: string) => void;
};

const upcomingDays = 30;

type Navigation = {
  screen: Atom<CalendarScreen["kind"]>;
  month: Atom<string>;
  selected: Atom<string>;
  opened: Atom<OpenedOccurrence | undefined>;
};

function reatomItems(data: CalendarData, timeZone: () => string) {
  return (range: { from: string; to: string }) =>
    itemsIn(
      {
        events: data.events.data() ?? [],
        pets: data.pets.data() ?? [],
        dues: data.dues.data() ?? [],
      },
      { range, timeZone: timeZone() },
    );
}

function reatomViews(
  { today }: CalendarDependencies,
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
    selected: computed(() => selected(), "calendar.selectedDate"),
    dayItems: computed(
      (): CalendarItem[] => monthItems().filter(({ date }) => date === selected()),
      "calendar.dayItems",
    ),
    upcoming: computed(
      (): CalendarItem[] => itemsOf({ from: today(), to: daysAfter(today(), upcomingDays) }),
      "calendar.upcoming",
    ),
  };
}

function reatomMoves(
  dependencies: CalendarDependencies,
  { screen, month, selected, opened }: Navigation,
  form: ReturnType<typeof reatomEventForm>,
) {
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
      if (item.kind === "event") {
        opened.set({ eventId: item.eventId, occurrence: item.occurrence });
        screen.set("event");
      } else {
        dependencies.onOpenPet(item.petId);
      }
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
    back: action(() => {
      screen.set(screen() === "event-form" && opened() !== undefined ? "event" : "calendar");
    }, "calendar.back"),
  };
}

type Parts = {
  form: ReturnType<typeof reatomEventForm>;
  details: ReturnType<typeof reatomEventDetails>;
};

function reatomTitle(screen: Atom<CalendarScreen["kind"]>, { form, details }: Parts) {
  return computed(() => {
    const kind = screen();

    if (kind === "event-form") {
      return form.isCreating() ? "Новое событие" : "Событие";
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

export function reatomCalendar(dependencies: CalendarDependencies) {
  const data = reatomCalendarData(dependencies);
  const navigation: Navigation = {
    screen: atom<CalendarScreen["kind"]>("calendar", "calendar.screenKind"),
    month: atom(dependencies.today().slice(0, "YYYY-MM".length), "calendar.month"),
    selected: atom(dependencies.today(), "calendar.selected"),
    opened: atom<OpenedOccurrence | undefined>(undefined, "calendar.opened"),
  };
  const { screen, opened } = navigation;
  const form = reatomEventForm({
    ...dependencies,
    data,
    onSaved: (saved) => {
      opened.set({ eventId: saved.id, occurrence: saved.start.date });
      screen.set("event");
    },
  });
  const details = reatomEventDetails({
    ...dependencies,
    data,
    opened,
    onClosed: () => {
      opened.set(undefined);
      screen.set("calendar");
    },
  });

  return {
    screen: computed((): CalendarScreen => ({ kind: screen() }), "calendar.screen"),
    title: reatomTitle(screen, { form, details }),
    canGoBack: computed(() => screen() !== "calendar", "calendar.canGoBack"),
    form,
    details,
    ...reatomViews(dependencies, navigation, reatomItems(data, dependencies.timeZone)),
    ...reatomMoves(dependencies, navigation, form),
    edit: action(() => {
      editOpened(screen, { form, details });
    }, "calendar.edit"),
  };
}

export type CalendarModel = ReturnType<typeof reatomCalendar>;
