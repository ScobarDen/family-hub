import {
  action,
  atom,
  computed,
  reatomBoolean,
  reatomEnum,
  withAbort,
  withLocalStorage,
  wrap,
  type Atom,
} from "@reatom/core";

import type { Pet, Task } from "@family-hub/contract";

import type { DeviceCache } from "@/common/device-cache";
import type { Viewer } from "@/common/format-date";
import type { LiveVersion } from "@/common/live-updates";
import { detached, instantly, type Slide } from "@/common/state";
import type { ClosingConfirmation, Dialogs, Haptics } from "@/common/telegram";

import { detailsOf, type TaskDetails } from "../task-details.lib.ts";
import {
  birthdayRowsOf,
  groupsOf,
  isMine,
  nextOccurrenceOf,
  rowsOf,
  type TaskGroups,
  type TaskRow,
} from "../task-rows.lib.ts";
import type { TaskOccurrence, TasksApi } from "../tasks.api.ts";
import { reatomTasks, type SharedLists, type TasksModel } from "../tasks.model.ts";
import { reatomCalendar } from "./calendar.vm.ts";
import { reatomSubtaskForm } from "./subtask-form.vm.ts";
import { reatomTaskActions, type CareRecord } from "./task-actions.vm.ts";
import { reatomTaskForm, type TaskDraftOpening } from "./task-form.vm.ts";

export type TasksScreen =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "list"; groups: TaskGroups; empty: EmptyList | undefined; isCompletedShown: boolean }
  | { kind: "calendar" }
  | { kind: "task"; task: TaskDetails }
  | { kind: "task-form"; isCreating: boolean }
  | { kind: "subtask-form"; isCreating: boolean };

// What the list says when nothing is left to do: «add the first one» only to a Family with none.
export type EmptyList = { title: string; hint: string | undefined };

type TasksDependencies = SharedLists &
  LiveVersion & {
    api: TasksApi;
    deviceCache: Pick<DeviceCache, "withDeviceCache">;
    telegram: Pick<Dialogs, "showPopup"> & ClosingConfirmation & { haptics: Haptics };
    self: () => string | undefined;
    viewer: () => Viewer;
    onOpenAlbum: (albumId: string) => void;
    onOpenPet: (petId: string) => void;
    onRecord: (record: CareRecord) => void;
    onDraftSaved: (draftId: string) => void;
    slide?: Slide;
  };

type Navigation = {
  editing: Atom<"task" | "subtask" | undefined>;
  opened: Atom<TaskOccurrence | undefined>;
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
    opened: atom<TaskOccurrence | undefined>(undefined, "tasks.opened"),
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
      haptics: dependencies.telegram.haptics,
      closingConfirmation: dependencies.telegram,
      timeZone: () => dependencies.viewer().timeZone,
      onSaved,
    }),
    subtaskForm: reatomSubtaskForm({
      ...dependencies,
      haptics: dependencies.telegram.haptics,
      closingConfirmation: dependencies.telegram,
      onSaved,
    }),
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

function emptyOf(
  { overdue, today, upcoming, undated }: TaskGroups,
  { hasFamilyTasks, scope }: { hasFamilyTasks: boolean; scope: "mine" | "all" },
): EmptyList | undefined {
  if ([overdue, today, upcoming, undated].some((group) => group.length > 0)) {
    return undefined;
  }

  if (!hasFamilyTasks) {
    return { title: "Дел нет", hint: "Нажмите «Добавить дело», чтобы завести первое" };
  }

  return scope === "mine"
    ? { title: "Ваших дел нет", hint: "Дела всей семьи — во вкладке «Все»" }
    : { title: "Открытых дел нет", hint: undefined };
}

function browsingScreenOf(
  navigation: Navigation,
  { tasks, pets, family }: { tasks: Task[]; pets: Pet[]; family: Task[] | undefined },
  viewer: Viewer,
): TasksScreen {
  if (navigation.view() === "calendar") {
    return { kind: "calendar" };
  }

  const groups = groupsOf(
    [...tasks.flatMap((each) => rowsOf(each, viewer)), ...birthdayRowsOf(pets, viewer.today)],
    viewer.today,
  );

  return {
    kind: "list",
    groups,
    empty: emptyOf(groups, {
      hasFamilyTasks: (family ?? []).length > 0,
      scope: navigation.scope(),
    }),
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

    const tasks = shown();
    const task = openedTask();
    const viewer = dependencies.viewer();

    if (tasks === undefined) {
      return dependencies.tasks.list.error() === undefined
        ? { kind: "loading" }
        : { kind: "failed" };
    }

    return task === undefined
      ? browsingScreenOf(
          navigation,
          {
            tasks,
            pets: dependencies.pets.data() ?? [],
            family: dependencies.tasks.list.data(),
          },
          viewer,
        )
      : { kind: "task", task: detailsOf(task, navigation.opened()?.occurrence ?? null, viewer) };
  }, "tasks.screen");
}

// A deep link or another module names the Task, not an Occurrence, and may come before the list.
function reatomOpen({ editing, opened }: Navigation, viewer: () => Viewer, tasks: TasksModel) {
  return action(async (taskId: string) => {
    editing.set(undefined);

    const all = tasks.list.data() ?? (await wrap(tasks.loaded()));
    const task = all.find(({ id }) => id === taskId);

    opened.set({
      taskId,
      occurrence: task === undefined ? null : nextOccurrenceOf(task, viewer()),
    });
  }, "tasks.openTask").extend(withAbort());
}

function reatomBrowsing(
  navigation: Navigation,
  { viewer, onOpenAlbum, telegram, slide = instantly }: TasksDependencies,
  tasks: TasksModel,
) {
  const { editing, opened } = navigation;

  return {
    openRow: action((row: TaskRow) => {
      slide("forward", () => {
        opened.set({ taskId: row.taskId, occurrence: row.occurrence });
      });
    }, "tasks.openRow"),
    open: detached(reatomOpen(navigation, viewer, tasks), "tasks.open"),
    toggleCompleted: action(() => {
      telegram.haptics.select();
      navigation.isCompletedShown.toggle();
    }, "tasks.toggleCompleted"),
    showView: action((view: "list" | "calendar") => {
      telegram.haptics.select();
      navigation.view.set(view);
    }, "tasks.showView"),
    showScope: action((scope: "mine" | "all") => {
      telegram.haptics.select();
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

// Which screen is shown, apart from the data it shows, so a renamed Task keeps focus where it is.
function reatomScreenKey({ editing, opened }: Navigation, { taskForm, subtaskForm }: Forms) {
  return computed(() => {
    const current = editing();
    const isCreating = current === "task" ? taskForm.isCreating() : subtaskForm.isCreating();

    return current === undefined
      ? (opened()?.taskId ?? "list")
      : `${current}:${isCreating ? "new" : "edit"}`;
  }, "tasks.screenKey");
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
    onClosed: () => {
      navigation.opened.set(undefined);
    },
  });
  const screen = reatomScreen(dependencies, navigation, { forms, shown, openedTask });

  return {
    screen,
    title: computed(() => titleOf(screen()), "tasks.title"),
    screenKey: reatomScreenKey(navigation, forms),
    view: navigation.view,
    scope: navigation.scope,
    reload: tasks.reload,
    tasksOf: tasksOfPet(tasks, input.viewer),
    canGoBack: computed(
      () => navigation.editing() !== undefined || openedTask() !== undefined,
      "tasks.canGoBack",
    ),
    ...forms,
    ...actions,
    ...reatomCalendar(input, { ...navigation, shown }),
    ...reatomBrowsing(navigation, input, tasks),
    ...reatomAdding(navigation, forms),
    ...reatomEditing(navigation, { forms, openedTask }),
  };
}

export type TasksScreenModel = ReturnType<typeof reatomTasksScreen>;
