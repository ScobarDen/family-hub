import { action, computed, type Atom } from "@reatom/core";

import type { Pet, Task } from "@family-hub/contract";

import { formatNearDate, type Viewer } from "@/common/format-date.lib.ts";
import type { Haptics } from "@/modules/telegram";

import {
  agendaRowsOf,
  itemsIn,
  monthGrid,
  monthRangeOf,
  monthTitle,
  shiftMonth,
  type CalendarItem,
} from "../calendar.lib.ts";
import type { TaskOccurrence } from "../tasks.api.ts";

type CalendarDependencies = {
  viewer: () => Viewer;
  pets: { data: () => Pet[] | undefined };
  onOpenPet: (petId: string) => void;
  telegram: { haptics: Pick<Haptics, "select"> };
};

type CalendarState = {
  month: Atom<string>;
  selected: Atom<string>;
  opened: Atom<TaskOccurrence | undefined>;
  shown: () => Task[] | undefined;
};

function reatomCalendarMoves(
  { onOpenPet, telegram }: CalendarDependencies,
  { month, selected, opened }: CalendarState,
) {
  return {
    previousMonth: action(() => {
      month.set(shiftMonth(month(), -1));
    }, "tasks.previousMonth"),
    nextMonth: action(() => {
      month.set(shiftMonth(month(), 1));
    }, "tasks.nextMonth"),
    select: action((date: string) => {
      telegram.haptics.select();
      selected.set(date);
    }, "tasks.select"),
    openPet: action((petId: string) => {
      onOpenPet(petId);
    }, "tasks.openPet"),
    openItem: action((item: CalendarItem) => {
      if (item.kind === "birthday") {
        onOpenPet(item.petId);
      } else {
        opened.set({ taskId: item.taskId, occurrence: item.occurrence });
      }
    }, "tasks.openItem"),
  };
}

export function reatomCalendar(dependencies: CalendarDependencies, state: CalendarState) {
  const { month, selected, shown } = state;
  const monthItems = computed(() => {
    const { today, timeZone } = dependencies.viewer();

    return itemsIn(
      { tasks: shown() ?? [], pets: dependencies.pets.data() ?? [] },
      { range: monthRangeOf(month()), timeZone, today },
    );
  }, "tasks.monthItems");

  return {
    monthTitle: computed(() => monthTitle(month()), "tasks.monthTitle"),
    grid: computed(
      () => monthGrid(month(), { today: dependencies.viewer().today, items: monthItems() }),
      "tasks.grid",
    ),
    selected,
    dayTitle: computed(
      () => formatNearDate(selected(), dependencies.viewer().today),
      "tasks.dayTitle",
    ),
    dayRows: computed(
      () => agendaRowsOf(monthItems().filter(({ date }) => date === selected())),
      "tasks.dayRows",
    ),
    ...reatomCalendarMoves(dependencies, state),
  };
}
