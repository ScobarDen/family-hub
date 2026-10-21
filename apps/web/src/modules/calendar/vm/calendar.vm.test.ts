import { context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import {
  eventChange,
  reminderChange,
  type CalendarEvent,
  type DueDateItem,
  type Pet,
  type Reminder,
} from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client";

import { createCalendarApi } from "../calendar.api.ts";
import { reatomCalendar } from "./calendar.vm.ts";

const call: CalendarEvent = {
  id: "event-1",
  title: "Созвон с родителями",
  note: null,
  start: { date: "2026-10-01", time: "19:00", timeZone: "Europe/Moscow" },
  end: null,
  recurrence: { frequency: "weekly", until: null },
  visibility: "shared",
  isOwn: true,
  skippedDates: ["2026-10-08"],
  reminderOffsets: [],
};

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
};

const internet: Reminder = {
  id: "reminder-1",
  text: "Оплатить интернет",
  start: { date: "2026-10-16", time: "10:00", timeZone: "Europe/Moscow" },
  recurrence: { frequency: "monthly", until: null },
  visibility: "shared",
  isOwn: true,
  isForEveryone: true,
  recipients: [
    { id: "member-1", name: "Денис" },
    { id: "member-2", name: "Ася" },
  ],
};

const rabies: DueDateItem = {
  entryId: "entry-1",
  kind: "vaccination",
  title: "Бешенство",
  dueDate: "2026-10-25",
  isOverdue: false,
};

function fakeBackend() {
  const requests: Array<{ request: string; body: unknown }> = [];
  const replies: Record<string, (body: unknown) => unknown> = {
    "GET /api/events": () => [call],
    "GET /api/pets": () => [buick],
    "GET /api/pets/pet-1/due-dates": () => [rabies],
    "GET /api/reminders": () => [internet],
    "GET /api/family/members": () => [
      { id: "member-1", name: "Денис", isFamilyOwner: true },
      { id: "member-2", name: "Ася", isFamilyOwner: false },
    ],
    "POST /api/reminders": (body) => ({
      ...internet,
      ...reminderChange.parse(body),
      id: "reminder-2",
      isForEveryone: false,
      recipients: [{ id: "member-2", name: "Ася" }],
    }),
    "POST /api/events": (body) => ({
      ...call,
      ...eventChange.parse(body),
      id: "event-2",
      skippedDates: [],
      reminderOffsets: [],
    }),
    "POST /api/events/event-1/skip": () => ({
      ...call,
      skippedDates: ["2026-10-08", "2026-10-15"],
      reminderOffsets: [],
    }),
  };

  async function fetch(url: URL, init: RequestInit): Promise<Response> {
    const request = `${init.method ?? "GET"} ${url.pathname}`;
    const body: unknown = typeof init.body === "string" ? JSON.parse(init.body) : undefined;

    requests.push({ request, body });

    return Response.json(replies[request]?.(body) ?? {});
  }

  return { fetch, requests };
}

function startCalendar({ timeZone = "Europe/Moscow", choices = [] as string[] } = {}) {
  const backend = fakeBackend();
  const opened: string[] = [];
  const pending = [...choices];
  const model = reatomCalendar({
    api: createCalendarApi(
      createHttpClient({ baseUrl: "https://api.family-hub.test", fetch: backend.fetch }),
    ),
    today: () => "2026-10-14",
    timeZone: () => timeZone,
    telegram: { showPopup: async () => pending.shift() },
    onOpenPet: (petId) => {
      opened.push(petId);
    },
    self: () => "member-1",
  });

  model.grid.subscribe(noop);
  model.upcoming.subscribe(noop);
  model.dayItems.subscribe(noop);
  model.reminderForm.recipients.subscribe(noop);

  return { model, backend, opened };
}

type Model = ReturnType<typeof startCalendar>["model"];

async function loaded(model: Model) {
  await vi.waitFor(() => {
    expect(model.upcoming().map(({ kind }) => kind)).toContain("due");
  });
}

function upcomingAt(model: Model, index: number) {
  const item = model.upcoming()[index];

  if (item === undefined) {
    throw new Error(`Nothing at ${index} in «Ближайшее»`);
  }

  return item;
}

beforeEach(() => {
  context.reset();
});

describe("the month", () => {
  test("starts on Monday, marks today and the days that have something", async () => {
    const { model } = startCalendar();

    await loaded(model);

    const grid = model.grid();

    expect(model.monthTitle()).toBe("Октябрь 2026");
    expect(grid[0]?.date).toBe("2026-09-28");
    expect(grid.find(({ isToday }) => isToday)?.date).toBe("2026-10-14");
    expect(grid.filter(({ hasItems }) => hasItems).map(({ date }) => date)).toEqual([
      "2026-10-01",
      "2026-10-15",
      "2026-10-16",
      "2026-10-20",
      "2026-10-22",
      "2026-10-25",
      "2026-10-29",
    ]);
  });

  test("moves to the next month", async () => {
    const { model } = startCalendar();

    model.nextMonth();

    expect(model.monthTitle()).toBe("Ноябрь 2026");
  });
});

describe("«Ближайшее»", () => {
  test("lists Occurrences, the Pet's birthday and its Due Dates for a month ahead", async () => {
    const { model } = startCalendar();

    await loaded(model);

    expect(model.upcoming().map(({ date, time, title }) => [date, time, title])).toEqual([
      ["2026-10-15", "19:00", "Созвон с родителями"],
      ["2026-10-16", "10:00", "Оплатить интернет"],
      ["2026-10-20", undefined, "День рождения: Бьюик, 4 года"],
      ["2026-10-22", "19:00", "Созвон с родителями"],
      ["2026-10-25", undefined, "Прививка: Бьюик, Бешенство"],
      ["2026-10-29", "19:00", "Созвон с родителями"],
      ["2026-11-05", "19:00", "Созвон с родителями"],
      ["2026-11-12", "19:00", "Созвон с родителями"],
    ]);
  });

  test("shows a timed Event at the viewer's own time and day", async () => {
    const { model } = startCalendar({ timeZone: "Asia/Vladivostok" });

    await loaded(model);

    expect(model.upcoming()[0]).toMatchObject({ date: "2026-10-16", time: "02:00" });
  });

  test("opens the Pet's card from a birthday or a Due Date", async () => {
    const { model, opened } = startCalendar();

    await loaded(model);
    model.openItem(upcomingAt(model, 2));

    expect(opened).toEqual(["pet-1"]);
  });
});

describe("an Event", () => {
  test("opens on the chosen Occurrence and skips just that one", async () => {
    const { model, backend } = startCalendar({ choices: ["confirm"] });

    await loaded(model);
    model.openItem(upcomingAt(model, 0));

    expect(model.screen()).toEqual({ kind: "event" });
    expect(model.details.details()).toMatchObject({
      when: "15 октября, 19:00",
      repeats: "Каждую неделю",
      isRecurring: true,
    });

    model.details.skipOccurrence();

    await vi.waitFor(() => {
      expect(model.screen()).toEqual({ kind: "calendar" });
    });
    expect(backend.requests.at(-1)).toEqual({
      request: "POST /api/events/event-1/skip",
      body: { date: "2026-10-15" },
    });
  });

  test("is added on the selected day, all day by default", async () => {
    const { model, backend } = startCalendar();

    await loaded(model);
    model.select("2026-10-18");
    model.add();
    model.form.form.fields.title.set("Пикник");
    model.form.save();

    await vi.waitFor(() => {
      expect(model.screen()).toEqual({ kind: "event" });
    });
    expect(backend.requests.at(-1)?.body).toMatchObject({
      title: "Пикник",
      start: { date: "2026-10-18", time: null, timeZone: null },
      recurrence: null,
    });
  });

  test("takes the creator's zone when it has a time", async () => {
    const { model, backend } = startCalendar({ timeZone: "Asia/Tbilisi" });

    await loaded(model);
    model.add();
    model.form.form.fields.title.set("Футбол");
    model.form.form.fields.timing.set("timed");
    model.form.form.fields.time.set("20:30");
    model.form.form.fields.frequency.set("weekly");
    model.form.save();

    await vi.waitFor(() => {
      expect(model.screen()).toEqual({ kind: "event" });
    });
    expect(backend.requests.at(-1)?.body).toMatchObject({
      start: { date: "2026-10-14", time: "20:30", timeZone: "Asia/Tbilisi" },
      recurrence: { frequency: "weekly", until: null },
    });
  });

  test("reminds at up to three chosen offsets", async () => {
    const { model, backend } = startCalendar();

    await loaded(model);
    model.add();
    model.form.form.fields.title.set("Созвон");
    model.form.form.fields.timing.set("timed");
    model.form.form.fields.time.set("19:00");

    for (const offset of ["1w", "1d", "1h", "15m"] as const) {
      model.form.toggleOffset(offset);
    }

    model.form.toggleOffset("1d");
    model.form.save();

    await vi.waitFor(() => {
      expect(model.screen()).toEqual({ kind: "event" });
    });
    expect(backend.requests.at(-1)?.body).toMatchObject({ reminderOffsets: ["1w", "1h"] });
  });

  test("offers only whole-day offsets for an all-day Event", async () => {
    const { model } = startCalendar();

    await loaded(model);
    model.add();

    expect(model.form.offsets().map(({ title }) => title)).toEqual([
      "В начале",
      "За день",
      "За неделю",
    ]);
  });

  test("keeps a Shared Event Shared when edited", async () => {
    const { model } = startCalendar();

    await loaded(model);
    model.openItem(upcomingAt(model, 0));
    model.edit();

    expect(model.screen()).toEqual({ kind: "event-form" });
    expect(model.form.canChooseVisibility()).toBe(false);
    expect(model.form.form.fields.time()).toBe("19:00");
  });
});

describe("a standalone Reminder", () => {
  test("is created for the chosen Recipients at the creator's time and zone", async () => {
    const { model, backend } = startCalendar({ timeZone: "Asia/Tbilisi" });

    await loaded(model);
    model.select("2026-10-20");
    model.addReminder();
    model.reminderForm.form.fields.text.set("Купить корм");
    model.reminderForm.form.fields.time.set("18:00");
    await vi.waitFor(() => {
      expect(model.reminderForm.recipients()).toHaveLength(2);
    });
    model.reminderForm.toggleRecipient("member-2");
    model.reminderForm.save();

    await vi.waitFor(() => {
      expect(model.screen()).toEqual({ kind: "calendar" });
    });
    expect(backend.requests.at(-1)?.body).toEqual({
      text: "Купить корм",
      start: { date: "2026-10-20", time: "18:00", timeZone: "Asia/Tbilisi" },
      recurrence: null,
      visibility: "shared",
      recipientIds: ["member-2"],
    });
  });

  test("goes to everyone when nobody is picked, and opens for editing from «Ближайшее»", async () => {
    const { model } = startCalendar();

    await loaded(model);
    model.openItem(upcomingAt(model, 1));

    expect(model.screen()).toEqual({ kind: "reminder-form" });
    expect(model.title()).toBe("Напоминание");
    expect(model.reminderForm.isForEveryone()).toBe(true);
    expect(model.reminderForm.canDelete()).toBe(true);
    expect(model.reminderForm.form.fields.frequency()).toBe("monthly");
  });
});
