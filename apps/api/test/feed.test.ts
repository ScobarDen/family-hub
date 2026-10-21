import { describe, expect, test } from "vite-plus/test";

import type { FeedPage, Pet, Plan } from "@family-hub/contract";

import { signInitData, type TelegramUserFixture } from "./init-data.ts";
import { startWorker } from "./worker-harness.ts";

const denis = { id: 111, first_name: "Денис" };
const asya = { id: 222, first_name: "Ася" };

async function request(
  worker: ReturnType<typeof startWorker>,
  user: TelegramUserFixture,
  { method = "GET", path, body }: { method?: string; path: string; body?: unknown },
) {
  const session = await worker.request("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      initData: signInitData({
        botToken: worker.env.BOT_TOKEN,
        user,
        authDate: worker.clock.iso(),
      }),
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
  const worker = startWorker({ now: "2026-10-01T09:00:00Z" });
  const { familyId } = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });

  worker.clock.set("2026-10-01T09:01:00Z");
  await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });

  for (const user of [denis, asya]) {
    await request(worker, user, {
      method: "PUT",
      path: "/api/me/time-zone",
      body: { timeZone: "Europe/Moscow", isAuto: true },
    });
  }

  return worker;
}

type Worker = Awaited<ReturnType<typeof startWithFamily>>;

async function feedOf(worker: Worker, user: TelegramUserFixture, before?: string) {
  const query = before === undefined ? "" : `?before=${encodeURIComponent(before)}`;
  const response = await request(worker, user, { path: `/api/feed${query}` });

  return response.json<FeedPage>();
}

async function addPlan(worker: Worker, user: TelegramUserFixture, change: Record<string, unknown>) {
  const response = await request(worker, user, {
    method: "POST",
    path: "/api/plans",
    body: {
      title: "Ремонт",
      note: null,
      dueDate: null,
      reminder: null,
      assigneeId: null,
      visibility: "shared",
      petId: null,
      ...change,
    },
  });

  return response.json<Plan>();
}

async function addBuick(worker: Worker) {
  const response = await request(worker, denis, {
    method: "POST",
    path: "/api/pets",
    body: {
      name: "Бьюик",
      species: "dog",
      breed: null,
      sex: null,
      birthDate: "2022-10-05",
      chipNumber: null,
      notes: null,
    },
  });

  return response.json<Pet>();
}

async function addEntry(worker: Worker, petId: string, details: Record<string, unknown>) {
  await request(worker, asya, {
    method: "POST",
    path: `/api/pets/${petId}/care-entries`,
    body: { occurredAt: worker.clock.now(), note: null, details },
  });
}

async function addEvent(
  worker: Worker,
  user: TelegramUserFixture,
  change: Record<string, unknown>,
) {
  await request(worker, user, {
    method: "POST",
    path: "/api/events",
    body: {
      note: null,
      end: null,
      recurrence: null,
      visibility: "shared",
      reminderOffsets: [],
      ...change,
    },
  });
}

function titles(items: Array<{ title: string }>) {
  return items.map(({ title }) => title);
}

describe("the Feed", () => {
  test("leads with what is overdue, then two weeks ahead in order", async () => {
    const worker = await startWithFamily();
    const buick = await addBuick(worker);

    await addEntry(worker, buick.id, {
      kind: "treatment",
      target: "Клещи",
      product: null,
      cost: null,
      dueDate: "2026-09-25",
    });
    await addEntry(worker, buick.id, {
      kind: "vaccination",
      vaccine: "Бешенство",
      cost: null,
      dueDate: "2026-10-10",
    });
    await addPlan(worker, denis, { title: "Отправить документы", dueDate: "2026-09-28" });
    await addEvent(worker, denis, {
      title: "Созвон",
      start: { date: "2026-10-03", time: "19:00", timeZone: "Europe/Moscow" },
    });
    await addEvent(worker, denis, {
      title: "Через месяц",
      start: { date: "2026-10-30", time: null, timeZone: null },
    });
    await request(worker, asya, {
      method: "POST",
      path: "/api/reminders",
      body: {
        text: "Оплатить интернет",
        start: { date: "2026-10-02", time: "10:00", timeZone: "Europe/Moscow" },
        recurrence: null,
        visibility: "shared",
        recipientIds: null,
      },
    });

    const feed = await feedOf(worker, denis);

    expect(titles(feed.overdue)).toEqual(["Обработка: Клещи — Бьюик", "Отправить документы"]);
    expect(feed.upcoming.map(({ title, date }) => [title, date])).toEqual([
      ["Оплатить интернет", "2026-10-02"],
      ["Созвон", "2026-10-03"],
      ["День рождения: Бьюик", "2026-10-05"],
      ["Прививка: Бешенство — Бьюик", "2026-10-10"],
    ]);
  });

  test("keeps Private records for their owner", async () => {
    const worker = await startWithFamily();
    const surprise = await addPlan(worker, asya, {
      title: "Сюрприз",
      dueDate: "2026-10-05",
      visibility: "private",
    });

    await addEvent(worker, asya, {
      title: "Подарок",
      start: { date: "2026-10-04", time: null, timeZone: null },
      visibility: "private",
    });
    await request(worker, asya, { method: "POST", path: `/api/plans/${surprise.id}/complete` });

    const denisFeed = await feedOf(worker, denis);
    const asyaFeed = await feedOf(worker, asya);

    expect(titles(denisFeed.upcoming)).toEqual([]);
    expect(denisFeed.activity.map(({ kind }) => kind)).toEqual(["joined", "joined"]);
    expect(titles(asyaFeed.upcoming)).toEqual(["Подарок"]);
    expect(asyaFeed.activity[0]).toMatchObject({
      kind: "plan",
      title: "Сюрприз",
      memberName: "Ася",
    });
  });

  test("shows a Plan completed by its last Subplan as one line", async () => {
    const worker = await startWithFamily();
    const plan = await addPlan(worker, denis, {});

    for (const title of ["Купить обои", "Поклеить"]) {
      await request(worker, denis, {
        method: "POST",
        path: `/api/plans/${plan.id}/subplans`,
        body: { title, dueDate: null, assigneeId: null, reminder: null },
      });
    }

    const listed = await request(worker, denis, { path: "/api/plans" });
    const tree = await listed.json<Plan[]>();
    const [first, last] = tree[0]?.subplans ?? [];

    worker.clock.set("2026-10-01T10:00:00Z");
    await request(worker, asya, {
      method: "POST",
      path: `/api/plans/${plan.id}/subplans/${first?.id}/complete`,
    });
    worker.clock.set("2026-10-01T11:00:00Z");
    await request(worker, denis, {
      method: "POST",
      path: `/api/plans/${plan.id}/subplans/${last?.id}/complete`,
    });

    const feed = await feedOf(worker, denis);

    expect(
      feed.activity
        .filter(({ kind }) => kind === "plan")
        .map((item) => [item.kind === "plan" && item.title, item.memberName]),
    ).toEqual([
      ["Ремонт", "Денис"],
      ["Ремонт: Купить обои", "Ася"],
    ]);
  });

  // 35 entries go through the whole Worker one by one, which takes a while on a busy machine.
  test("pages older Activity by 30", async () => {
    const worker = await startWithFamily();
    const buick = await addBuick(worker);

    for (let minute = 10; minute < 45; minute += 1) {
      worker.clock.set(`2026-10-01T10:${minute}:00Z`);
      await addEntry(worker, buick.id, { kind: "weight", weightKg: 30 });
    }

    const first = await feedOf(worker, denis);
    const second = await feedOf(worker, denis, first.next ?? "");

    expect(first.activity).toHaveLength(30);
    expect(first.activity[0]).toMatchObject({ kind: "care", title: "Вес: 30 кг — Бьюик" });
    expect(second.activity.map(({ kind }) => kind)).toEqual([
      "care",
      "care",
      "care",
      "care",
      "care",
      "joined",
      "joined",
    ]);
    expect(second).toMatchObject({ overdue: [], upcoming: [], next: null });
  }, 30_000);
});
