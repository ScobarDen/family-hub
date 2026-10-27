import {
  action,
  atom,
  computed,
  reatomBoolean,
  reatomEnum,
  withLocalStorage,
  type Atom,
} from "@reatom/core";

import type { Task } from "@family-hub/contract";

import { formatNearDate, type Viewer } from "@/common/format-date";
import type { LiveVersion } from "@/common/live-updates";
import type { Dialogs } from "@/common/telegram";

import {
  agendaRowsOf,
  itemsIn,
  monthGrid,
  monthRangeOf,
  monthTitle,
  shiftMonth,
  type CalendarItem,
} from "../calendar.lib.ts";
import type { OccurrenceTarget, TasksApi } from "../tasks.api.ts";
import {
  detailsOf,
  groupsOf,
  isMine,
  nextOccurrenceOf,
  rowsOf,
  type TaskDetails,
  type TaskGroups,
  type TaskRow,
} from "../tasks.lib.ts";
import { reatomTasks, type SharedLists, type TasksModel } from "../tasks.model.ts";
import { reatomSubtaskForm } from "./subtask-form.vm.ts";
import { reatomTaskActions } from "./task-actions.vm.ts";
import { reatomTaskForm, type TaskDraftOpening } from "./task-form.vm.ts";

export type TasksScreen =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "list"; groups: TaskGroups; isCompletedShown: boolean }
  | { kind: "calendar" }
  | { kind: "task"; task: TaskDetails }
  | { kind: "task-form"; isCreating: boolean }
  | { kind: "subtask-form"; isCreating: boolean };

type TasksDependencies = SharedLists &
  LiveVersion & {
    api: TasksApi;
    telegram: Pick<Dialogs, "showPopup">;
    self: () => string | undefined;
    viewer: () => Viewer;
    onOpenAlbum: (albumId: string) => void;
    onOpenPet: (petId: string) => void;
    onRecord: (petId: string) => void;
    onDraftSaved: (draftId: string) => void;
  };

type Navigation = {
  editing: Atom<"task" | "subtask" | undefined>;
  opened: Atom<OccurrenceTarget | undefined>;
  isCompletedShown: ReturnType<typeof reatomBoolean>;
  view: ReturnType<typeof reatomEnum<"list" | "calendar">>;
  scope: ReturnType<typeof reatomEnum<"mine" | "all">>;
  month: Atom<string>;
  selected: Atom<string>;
};

function reatomNavigation({ viewer }: TasksDependencies): Navigation {
  const { today } = viewer();

  return {
    editing: atom<"task" | "subtask" | undefined>(undefined, "tasks.editing"),
    opened: atom<OccurrenceTarget | undefined>(undefined, "tasks.opened"),
    isCompletedShown: reatomBoolean(false, "tasks.isCompletedShown"),
    // The list or the calendar is a per-device habit; without storage it starts at the list.
    view: reatomEnum(["list", "calendar"], "tasks.view").extend(withLocalStorage("tasks.view")),
    scope: reatomEnum(["all", "mine"], "tasks.scope"),
    month: atom(today.slice(0, "YYYY-MM".length), "tasks.month"),
    selected: atom(today, "tasks.selected"),
  };
}

function reatomForms(
  dependencies: TasksDependencies & { tasks: TasksModel },
  { editing, opened }: Navigation,
) {
  function onSaved(saved: Task): void {
    editing.set(undefined);
    opened.set({ taskId: saved.id, occurrence: nextOccurrenceOf(saved, dependencies.viewer()) });
  }

  return {
    taskForm: reatomTaskForm({
      ...dependencies,
      timeZone: () => dependencies.viewer().timeZone,
      onSaved,
    }),
    subtaskForm: reatomSubtaskForm({ ...dependencies, onSaved }),
  };
}

type Forms = ReturnType<typeof reatomForms>;

function reatomShown(
  dependencies: TasksDependencies & { tasks: TasksModel },
  { scope }: Navigation,
) {
  return computed((): Task[] | undefined => {
    const all = dependencies.tasks.list.data();

    return scope() === "mine" ? all?.filter((task) => isMine(task, dependencies.self())) : all;
  }, "tasks.shown");
}

function editingScreenOf(
  editing: "task" | "subtask" | undefined,
  forms: Forms,
): TasksScreen | undefined {
  if (editing === "task") {
    return { kind: "task-form", isCreating: forms.taskForm.isCreating() };
  }

  return editing === "subtask"
    ? { kind: "subtask-form", isCreating: forms.subtaskForm.isCreating() }
    : undefined;
}

function browsingScreenOf(navigation: Navigation, tasks: Task[], viewer: Viewer): TasksScreen {
  return navigation.view() === "calendar"
    ? { kind: "calendar" }
    : {
        kind: "list",
        groups: groupsOf(
          tasks.flatMap((each) => rowsOf(each, viewer)),
          viewer.today,
        ),
        isCompletedShown: navigation.isCompletedShown(),
      };
}

function reatomScreen(
  dependencies: TasksDependencies & { tasks: TasksModel },
  navigation: Navigation,
  {
    forms,
    shown,
    openedTask,
  }: { forms: Forms; shown: () => Task[] | undefined; openedTask: () => Task | undefined },
) {
  return computed((): TasksScreen => {
    const editing = editingScreenOf(navigation.editing(), forms);

    if (editing !== undefined) {
      return editing;
    }

    if (dependencies.tasks.list.error() !== undefined) {
      return { kind: "failed" };
    }

    const tasks = shown();
    const task = openedTask();
    const viewer = dependencies.viewer();

    if (tasks === undefined) {
      return { kind: "loading" };
    }

    return task === undefined
      ? browsingScreenOf(navigation, tasks, viewer)
      : { kind: "task", task: detailsOf(task, navigation.opened()?.occurrence ?? null, viewer) };
  }, "tasks.screen");
}

function reatomCalendarMoves({ onOpenPet }: TasksDependencies, navigation: Navigation) {
  const { month, selected } = navigation;

  return {
    previousMonth: action(() => {
      month.set(shiftMonth(month(), -1));
    }, "tasks.previousMonth"),
    nextMonth: action(() => {
      month.set(shiftMonth(month(), 1));
    }, "tasks.nextMonth"),
    select: action((date: string) => {
      selected.set(date);
    }, "tasks.select"),
    openItem: action((item: CalendarItem) => {
      if (item.kind === "birthday") {
        onOpenPet(item.petId);
      } else {
        navigation.opened.set({ taskId: item.taskId, occurrence: item.occurrence });
      }
    }, "tasks.openItem"),
  };
}

function reatomCalendarView(
  dependencies: TasksDependencies,
  navigation: Navigation,
  shown: () => Task[] | undefined,
) {
  const { month, selected } = navigation;
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
      () =>
        agendaRowsOf(
          monthItems().filter(({ date }) => date === selected()),
          false,
        ),
      "tasks.dayRows",
    ),
    ...reatomCalendarMoves(dependencies, navigation),
  };
}

function reatomBrowsing(
  navigation: Navigation,
  { viewer, onOpenAlbum }: TasksDependencies,
  tasks: TasksModel,
) {
  const { editing, opened } = navigation;

  return {
    openRow: action((row: TaskRow) => {
      opened.set({ taskId: row.taskId, occurrence: row.occurrence });
    }, "tasks.openRow"),
    // A deep link or another module names the Task, not an Occurrence.
    open: action((taskId: string) => {
      editing.set(undefined);

      const task = tasks.list.data()?.find(({ id }) => id === taskId);

      opened.set({
        taskId,
        occurrence: task === undefined ? null : nextOccurrenceOf(task, viewer()),
      });
    }, "tasks.open"),
    toggleCompleted: action(() => {
      navigation.isCompletedShown.toggle();
    }, "tasks.toggleCompleted"),
    showView: action((view: "list" | "calendar") => {
      navigation.view.set(view);
    }, "tasks.showView"),
    showScope: action((scope: "mine" | "all") => {
      navigation.scope.set(scope);
    }, "tasks.showScope"),
    back: action(() => {
      if (editing() === undefined) {
        opened.set(undefined);
      } else {
        editing.set(undefined);
      }
    }, "tasks.back"),
    openAlbum: action((albumId: string) => {
      onOpenAlbum(albumId);
    }, "tasks.openAlbum"),
  };
}

function reatomAdding({ editing, opened, view, selected }: Navigation, forms: Forms) {
  return {
    // The calendar adds on the day picked; the list asks for a date only if one is wanted.
    add: action(() => {
      opened.set(undefined);
      forms.taskForm.startCreating({ date: view() === "calendar" ? selected() : "" });
      editing.set("task");
    }, "tasks.add"),
    addForPet: action((petId: string) => {
      opened.set(undefined);
      forms.taskForm.startCreating({ petId });
      editing.set("task");
    }, "tasks.addForPet"),
    openDraft: action((opening: TaskDraftOpening) => {
      opened.set(undefined);
      forms.taskForm.startFromDraft(opening);
      editing.set("task");
    }, "tasks.openDraft"),
  };
}

function reatomEditing(
  { editing }: Navigation,
  { forms, openedTask }: { forms: Forms; openedTask: () => Task | undefined },
) {
  function editWith(start: (task: Task) => void, target: "task" | "subtask"): void {
    const task = openedTask();

    if (task !== undefined) {
      start(task);
      editing.set(target);
    }
  }

  return {
    edit: action(() => {
      editWith(forms.taskForm.startEditing, "task");
    }, "tasks.edit"),
    addSubtask: action(() => {
      editWith(forms.subtaskForm.startAdding, "subtask");
    }, "tasks.addSubtask"),
    editSubtask: action((subtaskId: string) => {
      editWith((task) => {
        forms.subtaskForm.startEditing(task, subtaskId);
      }, "subtask");
    }, "tasks.editSubtask"),
  };
}

function titleOf(screen: TasksScreen): string {
  if (screen.kind === "task") {
    return screen.task.title;
  }

  if (screen.kind === "task-form") {
    return screen.isCreating ? "Новое дело" : "Дело";
  }

  return screen.kind === "subtask-form" ? "Шаг" : "Дела";
}

// The pet card shows a Pet's Overdue and upcoming Tasks; the tasks module stays their only source.
function tasksOfPet(tasks: TasksModel, viewer: () => Viewer) {
  return (petId: string): TaskRow[] => {
    const { overdue, today, upcoming, undated } = groupsOf(
      (tasks.list.data() ?? [])
        .filter(({ pet }) => pet?.id === petId)
        .flatMap((task) => rowsOf(task, viewer())),
      viewer().today,
    );

    return [...overdue, ...today, ...upcoming, ...undated];
  };
}

export function reatomTasksScreen(input: TasksDependencies) {
  const tasks = reatomTasks(input);
  const dependencies = { ...input, tasks };
  const navigation = reatomNavigation(input);
  const openedTask = computed(
    () => tasks.list.data()?.find(({ id }) => id === navigation.opened()?.taskId),
    "tasks.openedTask",
  );
  const shown = reatomShown(dependencies, navigation);
  const forms = reatomForms(dependencies, navigation);
  const actions = reatomTaskActions({
    ...dependencies,
    opened: navigation.opened,
    onDeleted: () => {
      navigation.opened.set(undefined);
    },
  });
  const screen = reatomScreen(dependencies, navigation, { forms, shown, openedTask });

  return {
    screen,
    title: computed(() => titleOf(screen()), "tasks.title"),
    view: navigation.view,
    scope: navigation.scope,
    retry: tasks.reload,
    reload: tasks.reload,
    tasksOf: tasksOfPet(tasks, input.viewer),
    canGoBack: computed(
      () => navigation.editing() !== undefined || openedTask() !== undefined,
      "tasks.canGoBack",
    ),
    ...forms,
    ...actions,
    ...reatomCalendarView(input, navigation, shown),
    ...reatomBrowsing(navigation, input, tasks),
    ...reatomAdding(navigation, forms),
    ...reatomEditing(navigation, { forms, openedTask }),
  };
}

export type TasksScreenModel = ReturnType<typeof reatomTasksScreen>;
