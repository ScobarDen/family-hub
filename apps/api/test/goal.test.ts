import { describe, expect, test } from "vite-plus/test";

import type { FeedPage, Goal, GoalChange, GoalList, MovementChange } from "@family-hub/contract";

import { signInitData, type TelegramUserFixture } from "./init-data.ts";
import { startWorker } from "./worker-harness.ts";

const denis = { id: 111, first_name: "Денис" };
const asya = { id: 222, first_name: "Ася" };

const turkey: GoalChange = {
  title: "Отпуск в Турции",
  target: 100_000,
  deadline: "2027-06-01",
  icon: "palmtree",
  color: "teal",
  note: null,
  visibility: "shared",
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
  const { familyId, ownerId } = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });
  const asyaId = await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });

  return Object.assign(worker, { denisId: ownerId, asyaId });
}

type Worker = Awaited<ReturnType<typeof startWithFamily>>;

async function addGoal(
  worker: Worker,
  user: TelegramUserFixture,
  change: Partial<GoalChange> = {},
) {
  const response = await request(worker, user, {
    method: "POST",
    path: "/api/goals",
    body: { ...turkey, ...change },
  });

  return response.json<Goal>();
}

async function move(
  worker: Worker,
  user: TelegramUserFixture,
  { goalId, ...change }: Partial<MovementChange> & { goalId: string },
) {
  return request(worker, user, {
    method: "POST",
    path: `/api/goals/${goalId}/movements`,
    body: { kind: "contribution", amount: 10_000, date: "2026-10-01", comment: null, ...change },
  });
}

async function listOf(worker: Worker, user: TelegramUserFixture) {
  const response = await request(worker, user, { path: "/api/goals" });

  return response.json<GoalList>();
}

describe("a Savings Goal", () => {
  test("adds up Contributions and Withdrawals per Member and never goes below zero", async () => {
    const worker = await startWithFamily();
    const goal = await addGoal(worker, denis);

    await move(worker, denis, { goalId: goal.id, amount: 30_000 });
    await move(worker, asya, { goalId: goal.id, amount: 20_000, date: "2026-09-15" });
    await move(worker, denis, { goalId: goal.id, kind: "withdrawal", amount: 5000 });

    const tooMuch = await move(worker, asya, {
      goalId: goal.id,
      kind: "withdrawal",
      amount: 50_000,
    });
    const { goals } = await listOf(worker, denis);
    const [saved] = goals;

    expect(tooMuch.status).toBe(409);
    expect(saved?.balance).toBe(45_000);
    expect(saved?.shares).toEqual([
      { id: worker.asyaId, name: "Ася", contributed: 20_000, withdrawn: 0 },
      { id: worker.denisId, name: "Денис", contributed: 30_000, withdrawn: 5000 },
    ]);
  });

  test("records money on behalf of another Member, changed and deleted only by its author", async () => {
    const worker = await startWithFamily();
    const goal = await addGoal(worker, denis);
    const response = await move(worker, denis, { goalId: goal.id, memberId: worker.asyaId });
    const { movements } = await response.json<Goal>();
    const [movement] = movements;
    const path = `/api/goals/${goal.id}/movements/${movement?.id}`;

    const byOther = await request(worker, asya, { method: "DELETE", path });
    const byAuthor = await request(worker, denis, {
      method: "PUT",
      path,
      body: { kind: "contribution", amount: 15_000, date: "2026-10-01", comment: "премия" },
    });

    expect(movement).toMatchObject({ member: { name: "Ася" }, recordedBy: { name: "Денис" } });
    expect(byOther.status).toBe(403);
    const changed = await byAuthor.json<Goal>();

    expect(changed.movements[0]).toMatchObject({
      amount: 15_000,
      member: { name: "Ася" },
      comment: "премия",
    });
  });

  test("is Achieved while its Balance reaches the target", async () => {
    const worker = await startWithFamily();
    const goal = await addGoal(worker, denis, { target: 20_000 });

    await move(worker, denis, { goalId: goal.id, amount: 20_000 });

    const before = await listOf(worker, denis);
    const [achieved] = before.goals;
    const response = await move(worker, denis, {
      goalId: goal.id,
      kind: "withdrawal",
      amount: 1000,
    });

    expect(achieved?.isAchieved).toBe(true);
    const after = await response.json<Goal>();

    expect(after.isAchieved).toBe(false);
  });

  test("turns read-only once completed and leaves the total", async () => {
    const worker = await startWithFamily();
    const goal = await addGoal(worker, denis);
    const sofa = await addGoal(worker, asya, { title: "Диван", target: 50_000 });

    await move(worker, denis, { goalId: goal.id, amount: 40_000 });
    await move(worker, asya, { goalId: sofa.id, amount: 7000 });
    await request(worker, denis, {
      method: "POST",
      path: `/api/goals/${goal.id}/complete`,
      body: { outcome: "fulfilled" },
    });

    const late = await move(worker, asya, { goalId: goal.id });
    const list = await listOf(worker, asya);

    expect(late.status).toBe(409);
    expect(list.totalSaved).toBe(7000);
    expect(list.goals[0]).toMatchObject({
      balance: 40_000,
      completed: { by: "Денис", outcome: "fulfilled" },
    });
  });

  test("kept Private stays out of others' totals and Feed", async () => {
    const worker = await startWithFamily();
    const secret = await addGoal(worker, asya, { title: "Подарок Денису", visibility: "private" });
    const shared = await addGoal(worker, denis);

    await move(worker, asya, { goalId: secret.id, amount: 3000 });
    await move(worker, asya, { goalId: shared.id, amount: 1000 });

    const denisList = await listOf(worker, denis);
    const asyaList = await listOf(worker, asya);
    const feedResponse = await request(worker, denis, { path: "/api/feed" });
    const feed = await feedResponse.json<FeedPage>();

    expect(denisList.goals.map(({ title }) => title)).toEqual(["Отпуск в Турции"]);
    expect(denisList.totalSaved).toBe(1000);
    expect(asyaList.totalSaved).toBe(4000);
    expect(
      feed.activity
        .filter(({ kind }) => kind === "goal")
        .map((item) => [item.kind === "goal" && item.title, item.memberName]),
    ).toEqual([["+1 000 ₽ · Отпуск в Турции", "Ася"]]);
  });

  test("of a Private Goal takes only its owner's money", async () => {
    const worker = await startWithFamily();
    const secret = await addGoal(worker, asya, { visibility: "private" });
    const response = await move(worker, asya, { goalId: secret.id, memberId: worker.denisId });

    expect(response.status).toBe(400);
  });
});
