import { atom, noop } from "@reatom/core";
import { expect, vi } from "vite-plus/test";

import {
  occurrenceTarget,
  skipTarget,
  subtaskChange,
  taskChange,
  type FamilyMemberList,
  type Person,
  type Pet,
  type Task,
} from "@family-hub/contract";

import { reatomDeviceCache } from "@/common/device-cache";
import { createHttpClient } from "@/common/http-client";
import { fakeSlide } from "@/common/state";
import {
  fakeDeviceStorage,
  fakeHaptics,
  type FakeDeviceStorage,
  fakeWindow,
} from "@/common/telegram";

import type { TaskRow } from "../task-rows.lib.ts";
import { createTasksApi } from "../tasks.api.ts";
import type { CareRecord } from "./task-actions.vm.ts";
import { reatomTasksScreen } from "./tasks.vm.ts";

export const denis: Person = { id: "member-1", name: "Денис", profilePicture: null };
export const asya: Person = { id: "member-2", name: "Ася", profilePicture: null };

const members: FamilyMemberList = [
  { ...denis, isFamilyOwner: true },
  { ...asya, isFamilyOwner: false },
];

const buick: Pet = {
  id: "pet-1",
  name: "Бьюик",
  species: "dog",
  breed: null,
  sex: null,
  birthDate: "2022-10-20",
  chipNumber: null,
  notes: null,
  archivedAt: null,
  memo: { food: null, clinic: null, important: null, updatedAt: null, updatedBy: null },
  avatar: null,
};

export const doneAt = Date.parse("2026-10-05T18:30:00Z");
const serverError = 500;
const notFound = 404;

export function taskOf(fields: Partial<Task> & Pick<Task, "id" | "title">): Task {
  return {
    note: null,
    when: null,
    recurrence: null,
    skippedDates: [],
    assignees: [],
    recipients: "default",
    reminderOffsets: [],
    visibility: "shared",
    isOwn: true,
    pet: null,
    album: null,
    completions: [],
    subtasks: [],
    ...fields,
  };
}

function onDate(date: string): Task["when"] {
  return { date, time: null, timeZone: null, endDate: null, endTime: null };
}

export const vaccination = taskOf({
  id: "task-vaccination",
  title: "Прививка Бьюику",
  when: onDate("2026-10-12"),
  assignees: [asya],
  pet: { id: "pet-1", name: "Бьюик", picture: null },
});

export const food = taskOf({
  id: "task-food",
  title: "Купить корм",
  when: {
    date: "2026-10-16",
    time: "19:00",
    timeZone: "Europe/Moscow",
    endDate: null,
    endTime: null,
  },
  assignees: [denis],
  reminderOffsets: ["1h"],
});

const repair = taskOf({ id: "task-repair", title: "Ремонт", when: onDate("2026-10-20") });

export const vacation = taskOf({ id: "task-vacation", title: "Отпуск" });

const passport = taskOf({
  id: "task-passport",
  title: "Паспорт",
  completions: [{ occurrence: null, at: doneAt, by: "Денис" }],
});

export const cleaning = taskOf({
  id: "task-cleaning",
  title: "Уборка",
  when: onDate("2026-10-02"),
  recurrence: { frequency: "weekly", until: null },
  assignees: [asya],
});

type Sent = { request: string; body: unknown };

type Route = (body: unknown, ids: { taskId: string; subtaskId: string }) => unknown;

type Save = (taskId: string, change: (task: Task) => Task) => Task;

function completedSubtask(task: Task, subtaskId: string): Task {
  const subtasks = task.subtasks.map((each) =>
    each.id === subtaskId ? { ...each, completed: { at: doneAt, by: "Денис" } } : each,
  );
  const isAllDone = subtasks.every(({ completed }) => completed !== null);

  return {
    ...task,
    subtasks,
    completions: isAllDone ? [{ occurrence: null, at: doneAt, by: "Денис" }] : task.completions,
  };
}

function patternOf(request: string) {
  const [, taskId = "", subtaskId = ""] =
    /^\w+ \/api\/tasks\/([^/]+)(?:\/subtasks\/([^/]+))?/u.exec(request) ?? [];
  const pattern = request
    .replace(`/subtasks/${subtaskId}`, "/subtasks/:sub")
    .replace(`/tasks/${taskId}`, "/tasks/:id");

  return { pattern, ids: { taskId, subtaskId } };
}

function editRoutes(save: Save): Record<string, Route> {
  return {
    "POST /api/tasks": (body) => {
      const change = taskChange.parse(body);

      return taskOf({ ...change, id: "task-new", recipients: "default", assignees: [] });
    },
    "PUT /api/tasks/:id": (body, { taskId }) =>
      save(taskId, (task) => {
        const { title, note, when, recurrence, reminderOffsets, visibility } =
          taskChange.parse(body);

        return { ...task, title, note, when, recurrence, reminderOffsets, visibility };
      }),
  };
}

function occurrenceRoutes(save: Save): Record<string, Route> {
  return {
    "POST /api/tasks/:id/complete": (body, { taskId }) =>
      save(taskId, (task) => ({
        ...task,
        completions: [
          ...task.completions,
          { occurrence: occurrenceTarget.parse(body).occurrence, at: doneAt, by: "Денис" },
        ],
      })),
    "POST /api/tasks/:id/reopen": (body, { taskId }) =>
      save(taskId, (task) => ({
        ...task,
        completions: task.completions.filter(
          ({ occurrence }) => occurrence !== occurrenceTarget.parse(body).occurrence,
        ),
      })),
    "POST /api/tasks/:id/skip": (body, { taskId }) =>
      save(taskId, (task) => ({
        ...task,
        skippedDates: [...task.skippedDates, skipTarget.parse(body).date],
      })),
  };
}

function subtaskRoutes(save: Save): Record<string, Route> {
  return {
    "POST /api/tasks/:id/subtasks": (body, { taskId }) =>
      save(taskId, (task) => {
        const { title, date } = subtaskChange.parse(body);
        const id = `sub-${task.subtasks.length + 1}`;

        return {
          ...task,
          subtasks: [...task.subtasks, { id, title, date, assignees: [], completed: null }],
        };
      }),
    "POST /api/tasks/:id/subtasks/:sub/complete": (_body, { taskId, subtaskId }) =>
      save(taskId, (task) => completedSubtask(task, subtaskId)),
    "POST /api/tasks/:id/subtasks/:sub/reopen": (_body, { taskId, subtaskId }) =>
      save(taskId, (task) => ({
        ...task,
        subtasks: task.subtasks.map((each) =>
          each.id === subtaskId ? { ...each, completed: null } : each,
        ),
      })),
    "DELETE /api/tasks/:id/subtasks/:sub": (_body, { taskId, subtaskId }) =>
      save(taskId, (task) => ({
        ...task,
        subtasks: task.subtasks.filter(({ id }) => id !== subtaskId),
      })),
  };
}

type BackendOptions = {
  failing?: string;
  unreachable?: string;
  answered?: Promise<void>;
  written?: Promise<void>;
};

async function reach(
  pattern: string,
  { unreachable, answered, written }: Omit<BackendOptions, "failing">,
): Promise<void> {
  await (pattern === "GET /api/tasks" ? answered : written);

  if (unreachable === pattern) {
    throw new TypeError("Failed to fetch");
  }
}

export function fakeBackend(
  initial: Task[] = [vaccination, food, repair, vacation, passport],
  {
    failing,
    unreachable,
    answered = Promise.resolve(),
    written = Promise.resolve(),
  }: BackendOptions = {},
) {
  let tasks = initial;
  const sent: Sent[] = [];

  function save(taskId: string, change: (task: Task) => Task): Task {
    tasks = tasks.map((each) => (each.id === taskId ? change(each) : each));

    return tasks.find(({ id }) => id === taskId) ?? vacation;
  }

  const routes: Record<string, Route> = {
    "GET /api/tasks": () => tasks,
    "GET /api/albums": () => [],
    "DELETE /api/tasks/:id": () => ({ status: "deleted" }),
    ...editRoutes(save),
    ...occurrenceRoutes(save),
    ...subtaskRoutes(save),
  };

  async function fetch(url: URL, init: RequestInit): Promise<Response> {
    const request = `${init.method ?? "GET"} ${url.pathname}`;
    const body: unknown = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    const { pattern, ids } = patternOf(request);
    const route = routes[pattern];

    sent.push({ request, body });

    await reach(pattern, { unreachable, answered, written });

    if (failing === pattern) {
      return Response.json({ code: "INTERNAL", message: "" }, { status: serverError });
    }

    return route === undefined
      ? Response.json({ code: "TASK_NOT_FOUND", message: "" }, { status: notFound })
      : Response.json(route(body, ids));
  }

  return { fetch, sent };
}

export function fakeTelegram(choices: string[] = []) {
  const pending = [...choices];

  return {
    ...fakeWindow(),
    async showPopup() {
      return pending.shift();
    },
    haptics: fakeHaptics(),
  };
}

type TelegramFake = ReturnType<typeof fakeTelegram>;

export function startTasks(
  backend = fakeBackend(),
  {
    telegram = fakeTelegram(),
    pets = [buick],
    device = fakeDeviceStorage(),
  }: { telegram?: TelegramFake; pets?: Pet[]; device?: FakeDeviceStorage } = {},
) {
  const client = createHttpClient({ baseUrl: "https://api.family-hub.test", fetch: backend.fetch });
  const recorded: CareRecord[] = [];
  const openedPets: string[] = [];
  const openedAlbums: string[] = [];
  const { slides, slide } = fakeSlide();
  const { felt } = telegram.haptics;
  const model = reatomTasksScreen({
    api: createTasksApi(client),
    deviceCache: reatomDeviceCache(device.deviceStorage),
    members: { data: atom(members) },
    pets: { data: atom(pets) },
    telegram,
    liveVersion: atom(0),
    self: () => "member-1",
    viewer: () => ({ timeZone: "Europe/Moscow", today: "2026-10-16" }),
    onOpenAlbum: (albumId) => {
      openedAlbums.push(albumId);
    },
    onOpenPet: (petId) => {
      openedPets.push(petId);
    },
    onRecord: (record) => {
      recorded.push(record);
    },
    onDraftSaved: noop,
    slide,
  });

  model.screen.subscribe(noop);

  return { model, backend, recorded, openedPets, openedAlbums, slides, felt };
}

type Model = ReturnType<typeof startTasks>["model"];

export async function loaded(model: Model) {
  await vi.waitFor(() => {
    expect(model.screen().kind).toBe("list");
  });
}

export function groups(model: Model) {
  const screen = model.screen();

  if (screen.kind !== "list") {
    throw new Error(`The list is not shown: ${screen.kind}`);
  }

  return screen.groups;
}

export function rowOf(model: Model, title: string, occurrence: string | null = null): TaskRow {
  const row = Object.values(groups(model))
    .flat()
    .find(
      (each): each is TaskRow =>
        each.kind === "task" &&
        each.title === title &&
        (occurrence === null || each.occurrence === occurrence),
    );

  if (row === undefined) {
    throw new Error(`No row ${title}`);
  }

  return row;
}
