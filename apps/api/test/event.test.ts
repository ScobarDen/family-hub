import { describe, expect, test } from "vite-plus/test";

import type { CalendarEvent } from "@family-hub/contract";

import { signInitData, type TelegramUserFixture } from "./init-data.ts";
import { startWorker } from "./worker-harness.ts";

const now = "2026-10-04T09:00:00Z";
const denis = { id: 111, first_name: "Денис" };
const asya = { id: 222, first_name: "Ася" };
const vika = { id: 333, first_name: "Вика" };

const call = {
  title: "Созвон с родителями",
  note: null,
  start: { date: "2026-10-08", time: "19:00", timeZone: "Europe/Moscow" },
  end: null,
  recurrence: { frequency: "weekly", until: null },
  visibility: "shared",
  reminderOffsets: [],
};

async function request(
  worker: ReturnType<typeof startWorker>,
  user: TelegramUserFixture,
  { method = "GET", path, body }: { method?: string; path: string; body?: unknown },
) {
  const session = await worker.request("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      initData: signInitData({ botToken: worker.env.BOT_TOKEN, user, authDate: now }),
    }),
  });
  const { token = "" } = await session.json<{ token?: string }>();

  return worker.request(path, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function startWithFamily() {
  const worker = startWorker({ now });
  const { familyId } = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });

  await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });

  return worker;
}

type Worker = Awaited<ReturnType<typeof startWithFamily>>;

async function createEvent(worker: Worker, user: TelegramUserFixture, change: object = {}) {
  const response = await request(worker, user, {
    method: "POST",
    path: "/api/events",
    body: { ...call, ...change },
  });

  return response.json<CalendarEvent>();
}

async function eventsOf(worker: Worker, user: TelegramUserFixture) {
  const response = await request(worker, user, { path: "/api/events" });

  return response.json<CalendarEvent[]>();
}

describe("an Event", () => {
  test("keeps a timed start with its creator's zone and its Recurrence", async () => {
    const worker = await startWithFamily();

    const created = await createEvent(worker, denis);

    expect(created).toEqual({
      id: expect.any(String),
      ...call,
      isOwn: true,
      skippedDates: [],
    });
    expect(await eventsOf(worker, asya)).toEqual([{ ...created, isOwn: false }]);
  });

  test("may be all-day with an end", async () => {
    const worker = await startWithFamily();

    const created = await createEvent(worker, asya, {
      title: "Отпуск",
      start: { date: "2026-11-01", time: null, timeZone: null },
      end: { date: "2026-11-10", time: null },
      recurrence: null,
    });

    expect(created).toMatchObject({
      start: { date: "2026-11-01", time: null, timeZone: null },
      end: { date: "2026-11-10", time: null },
    });
  });

  test.each([
    ["without a title", { title: " " }],
    ["timed without a zone", { start: { date: "2026-10-08", time: "19:00", timeZone: null } }],
    ["ending before it starts", { end: { date: "2026-10-01", time: null } }],
    ["repeating every day", { recurrence: { frequency: "daily", until: null } }],
  ])("is refused %s", async (_case, change) => {
    const worker = await startWithFamily();

    const response = await request(worker, denis, {
      method: "POST",
      path: "/api/events",
      body: { ...call, ...change },
    });

    expect(response.status).toBe(400);
  });

  test("is changed for the whole series by any Member and deleted only by its owner", async () => {
    const worker = await startWithFamily();
    const event = await createEvent(worker, denis);

    const changed = await request(worker, asya, {
      method: "PUT",
      path: `/api/events/${event.id}`,
      body: { ...call, start: { ...call.start, time: "20:00" } },
    });
    const refused = await request(worker, asya, {
      method: "DELETE",
      path: `/api/events/${event.id}`,
    });
    const deleted = await request(worker, denis, {
      method: "DELETE",
      path: `/api/events/${event.id}`,
    });

    expect(await changed.json()).toMatchObject({ start: { time: "20:00" } });
    expect(refused.status).toBe(403);
    expect(await deleted.json()).toEqual({ status: "deleted" });
  });

  test("skips one Occurrence and keeps the rest of the series", async () => {
    const worker = await startWithFamily();
    const event = await createEvent(worker, denis);

    await request(worker, asya, {
      method: "POST",
      path: `/api/events/${event.id}/skip`,
      body: { date: "2026-10-15" },
    });
    const skippedTwice = await request(worker, denis, {
      method: "POST",
      path: `/api/events/${event.id}/skip`,
      body: { date: "2026-10-15" },
    });

    expect(await skippedTwice.json()).toMatchObject({
      recurrence: { frequency: "weekly" },
      skippedDates: ["2026-10-15"],
    });
  });

  test("stays out of other Families", async () => {
    const worker = await startWithFamily();

    await worker.addFamily({ name: "Соседи", owner: { telegramId: vika.id, name: "Вика" } });
    const event = await createEvent(worker, denis);

    const skipped = await request(worker, vika, {
      method: "POST",
      path: `/api/events/${event.id}/skip`,
      body: { date: "2026-10-15" },
    });

    expect(await eventsOf(worker, vika)).toEqual([]);
    expect(skipped.status).toBe(404);
  });
});

describe("a Private Event", () => {
  test("is seen and reached only by its owner", async () => {
    const worker = await startWithFamily();
    const surprise = await createEvent(worker, asya, { title: "Сюрприз", visibility: "private" });

    const reached = await request(worker, denis, {
      method: "POST",
      path: `/api/events/${surprise.id}/skip`,
      body: { date: "2026-10-15" },
    });

    expect(await eventsOf(worker, denis)).toEqual([]);
    expect(reached.status).toBe(404);
  });

  test("may become Shared, but a Shared Event never becomes Private", async () => {
    const worker = await startWithFamily();
    const surprise = await createEvent(worker, asya, { visibility: "private" });

    const shared = await request(worker, asya, {
      method: "PUT",
      path: `/api/events/${surprise.id}`,
      body: { ...call, visibility: "shared" },
    });
    const back = await request(worker, asya, {
      method: "PUT",
      path: `/api/events/${surprise.id}`,
      body: { ...call, visibility: "private" },
    });

    expect(shared.status).toBe(200);
    expect(back.status).toBe(409);
  });

  test("goes with its owner when they leave, while their Shared Events pass to the Family Owner", async () => {
    const worker = await startWithFamily();

    await createEvent(worker, asya, { title: "Сюрприз", visibility: "private" });
    await createEvent(worker, asya, { title: "Ужин" });
    await request(worker, asya, { method: "POST", path: "/api/family/leave" });

    expect(await eventsOf(worker, denis)).toEqual([
      expect.objectContaining({ title: "Ужин", isOwn: true }),
    ]);
  });
});
