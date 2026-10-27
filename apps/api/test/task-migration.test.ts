import { describe, expect, test } from "vite-plus/test";

import type { FeedPage, TaskList } from "@family-hub/contract";

import { type TelegramUserFixture } from "./init-data.ts";
import { asya, denis, request, startWorker } from "./worker-harness.ts";

const at = Date.parse("2026-09-01T09:00:00Z");
const ids = {
  denis: "00000000-0000-7000-8000-000000000001",
  asya: "00000000-0000-7000-8000-000000000002",
  family: "00000000-0000-7000-8000-000000000003",
  buick: "00000000-0000-7000-8000-000000000004",
  ceiling: "00000000-0000-7000-8000-000000000010",
  paint: "00000000-0000-7000-8000-000000000011",
  vacuum: "00000000-0000-7000-8000-000000000012",
  dentist: "00000000-0000-7000-8000-000000000020",
  internet: "00000000-0000-7000-8000-000000000030",
  rabies: "00000000-0000-7000-8000-000000000040",
  ticksOld: "00000000-0000-7000-8000-000000000041",
  ticksNew: "00000000-0000-7000-8000-000000000042",
  checkup: "00000000-0000-7000-8000-000000000043",
};
const audit = `${at}, '${ids.denis}', ${at}`;
const rabies = JSON.stringify({
  kind: "vaccination",
  vaccine: "Бешенство",
  cost: null,
  dueDate: "2026-10-01",
});
const checkup = JSON.stringify({
  kind: "vet_visit",
  reason: null,
  cost: null,
  dueDate: "2026-10-20",
});

function ticks(dueDate: string | null) {
  return JSON.stringify({ kind: "treatment", target: "Клещи", product: null, cost: null, dueDate });
}

// What the database held before Tasks: a Plan with a Subplan, a Completed Plan, a timed Event, a
// standalone Reminder with a pending dispatch row, and two Due Dates of which one was followed up.
const seed = `
INSERT INTO members (id, telegram_id, name, time_zone, created_at, updated_at) VALUES
  ('${ids.denis}', ${denis.id}, 'Денис', 'Europe/Moscow', ${at}, ${at}),
  ('${ids.asya}', ${asya.id}, 'Ася', 'Europe/Moscow', ${at}, ${at});
INSERT INTO families (id, name, owner_member_id, created_at, created_by, updated_at) VALUES
  ('${ids.family}', 'Гущины', '${ids.denis}', ${audit});
INSERT INTO family_members (family_id, member_id, created_at, created_by, updated_at) VALUES
  ('${ids.family}', '${ids.denis}', ${audit}), ('${ids.family}', '${ids.asya}', ${audit});
INSERT INTO pets (id, family_id, name, species, created_at, created_by, updated_at) VALUES
  ('${ids.buick}', '${ids.family}', 'Бьюик', 'dog', ${audit});
INSERT INTO plans (id, family_id, parent_id, owner_member_id, visibility, title, due_date, reminder, assignee_member_id, completed_at, completed_by, created_at, created_by, updated_at) VALUES
  ('${ids.ceiling}', '${ids.family}', NULL, '${ids.denis}', 'shared', 'Покрасить потолок', '2026-10-20', 'on-day', '${ids.asya}', NULL, NULL, ${audit}),
  ('${ids.paint}', '${ids.family}', '${ids.ceiling}', NULL, NULL, 'Купить краску', '2026-10-10', NULL, NULL, ${at}, '${ids.asya}', ${audit}),
  ('${ids.vacuum}', '${ids.family}', NULL, '${ids.denis}', 'shared', 'Купить пылесос', NULL, NULL, NULL, ${at}, '${ids.denis}', ${audit});
INSERT INTO events (id, family_id, owner_member_id, visibility, title, start_date, start_time, time_zone, end_date, end_time, frequency, until, skipped_dates, reminder_offsets, created_at, created_by, updated_at) VALUES
  ('${ids.dentist}', '${ids.family}', '${ids.denis}', 'shared', 'Стоматолог', '2026-10-08', '15:00', 'Europe/Moscow', '2026-10-08', '17:00', 'weekly', NULL, '["2026-10-15"]', '["1h"]', ${audit});
INSERT INTO reminders (id, family_id, owner_member_id, visibility, text, start_date, start_time, time_zone, frequency, until, is_for_everyone, created_at, created_by, updated_at) VALUES
  ('${ids.internet}', '${ids.family}', '${ids.denis}', 'shared', 'Оплатить интернет', '2026-10-16', '19:00', 'Europe/Moscow', 'monthly', NULL, 0, ${audit});
INSERT INTO reminder_recipients (reminder_id, family_id, member_id) VALUES
  ('${ids.internet}', '${ids.family}', '${ids.asya}');
INSERT INTO reminder_dispatch (id, family_id, source, source_id, member_id, occurrence, next_fire_at, created_at, updated_at) VALUES
  ('dispatch-internet', '${ids.family}', 'reminder', '${ids.internet}', '${ids.asya}', '2026-10-16', ${Date.parse("2026-10-16T16:00:00Z")}, ${at}, ${at});
INSERT INTO care_entries (id, family_id, pet_id, kind, occurred_at, details, due_date, due_key, created_at, created_by, updated_at) VALUES
  ('${ids.rabies}', '${ids.family}', '${ids.buick}', 'vaccination', ${at}, '${rabies}', '2026-10-01', 'бешенство', ${audit}),
  ('${ids.ticksOld}', '${ids.family}', '${ids.buick}', 'treatment', ${at - 1000}, '${ticks("2026-09-15")}', '2026-09-15', 'клещи', ${audit}),
  ('${ids.ticksNew}', '${ids.family}', '${ids.buick}', 'treatment', ${at}, '${ticks(null)}', NULL, 'клещи', ${audit}),
  ('${ids.checkup}', '${ids.family}', '${ids.buick}', 'vet_visit', ${at}, '${checkup}', '2026-10-20', 'vet_visit', ${audit});
INSERT INTO reminder_dispatch (id, family_id, source, source_id, member_id, occurrence, next_fire_at, created_at, updated_at) VALUES
  ('dispatch-checkup', '${ids.family}', 'pet_due', '${ids.buick}:${ids.checkup}', '${ids.asya}', '2026-10-13', ${Date.parse("2026-10-13T06:00:00Z")}, ${at}, ${at});
`;

function startMigrated() {
  return startWorker({ now: "2026-10-04T09:00:00Z", seedBefore: { migration: "0026", sql: seed } });
}

type Worker = ReturnType<typeof startMigrated>;

async function bodyOf<Body>(response: Promise<Response>): Promise<Body> {
  const settled = await response;

  return settled.json<Body>();
}

async function tasksOf(worker: Worker, user: TelegramUserFixture): Promise<TaskList> {
  return bodyOf<TaskList>(request(worker, user, { path: "/api/tasks" }));
}

function taskNamed(tasks: TaskList, title: string) {
  return tasks.find((task) => task.title === title);
}

describe("the move to Tasks", () => {
  test("keeps a Plan's Assignee, due date, Reminder, Subtask and completion", async () => {
    const tasks = await tasksOf(startMigrated(), denis);

    expect(taskNamed(tasks, "Покрасить потолок")).toMatchObject({
      id: ids.ceiling,
      when: { date: "2026-10-20", time: null },
      assignees: [{ id: ids.asya }],
      reminderOffsets: ["at-start"],
      completions: [],
      subtasks: [{ title: "Купить краску", date: "2026-10-10", completed: { by: "Ася" } }],
    });
    expect(taskNamed(tasks, "Купить пылесос")).toMatchObject({
      when: null,
      completions: [{ occurrence: null, by: "Денис" }],
    });
  });

  test("keeps an Event's time, end, Recurrence, skipped dates and offsets without Assignees", async () => {
    const tasks = await tasksOf(startMigrated(), denis);

    expect(taskNamed(tasks, "Стоматолог")).toMatchObject({
      id: ids.dentist,
      when: { date: "2026-10-08", time: "15:00", timeZone: "Europe/Moscow", endTime: "17:00" },
      recurrence: { frequency: "weekly", until: null },
      skippedDates: ["2026-10-15"],
      reminderOffsets: ["1h"],
      assignees: [],
      recipients: "default",
    });
  });

  test("keeps a standalone Reminder's moment and Recipients, and fires its pending row once", async () => {
    const worker = startMigrated();

    expect(taskNamed(await tasksOf(worker, denis), "Оплатить интернет")).toMatchObject({
      when: { date: "2026-10-16", time: "19:00" },
      recurrence: { frequency: "monthly" },
      reminderOffsets: ["at-start"],
      recipients: [{ id: ids.asya }],
    });

    for (const moment of ["2026-10-16T16:00:00Z", "2026-10-16T16:01:00Z", "2026-10-16T17:00:00Z"]) {
      worker.clock.set(moment);
      await worker.tick();
    }

    expect(worker.bot.sentMessages().map(({ text }) => text)).toEqual([
      "📌 Оплатить интернет · 16 октября, 19:00",
    ]);
  });

  test("turns an open Due Date into an Overdue Pet Task of its author and leaves a followed-up one", async () => {
    const worker = startMigrated();
    const tasks = await tasksOf(worker, denis);
    const feed = await bodyOf<FeedPage>(request(worker, denis, { path: "/api/feed" }));

    expect(taskNamed(tasks, "Прививка: Бешенство")).toMatchObject({
      when: { date: "2026-10-01" },
      pet: { id: ids.buick },
      assignees: [{ id: ids.denis }],
    });
    expect(tasks.some(({ title }) => title.startsWith("Обработка"))).toBe(false);
    expect(feed.overdue.map(({ title }) => title)).toContain("Прививка: Бешенство — Бьюик");
  });

  test("reminds the author of a Due Date a week ahead and on the day, from the next cron tick", async () => {
    const worker = startMigrated();

    for (const moment of ["2026-10-04T09:01:00Z", "2026-10-13T06:00:00Z", "2026-10-20T06:00:00Z"]) {
      worker.clock.set(moment);
      await worker.tick();
    }

    expect(worker.bot.sentMessages().map(({ chat_id: chatId, text }) => [chatId, text])).toEqual([
      [denis.id, "🐾 Визит к ветеринару · 20 октября"],
      [denis.id, "🐾 Визит к ветеринару · 20 октября"],
    ]);
  });
});
