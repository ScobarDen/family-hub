import { context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { movementChange, type Goal } from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client";
import { createFamilyApi, reatomFamilyMembers } from "@/modules/family";

import { createGoalsApi } from "../goals.api.ts";
import { reatomGoalsScreen } from "./goals.vm.ts";

const turkey: Goal = {
  id: "goal-1",
  title: "Отпуск в Турции",
  target: 100_000,
  deadline: "2027-04-14",
  icon: "palmtree",
  color: "teal",
  note: null,
  visibility: "shared",
  isOwn: true,
  balance: 40_000,
  isAchieved: false,
  completed: null,
  shares: [{ id: "member-1", name: "Денис", contributed: 40_000, withdrawn: 0 }],
  movements: [],
};

const sofa: Goal = {
  ...turkey,
  id: "goal-2",
  title: "Диван",
  target: 30_000,
  deadline: null,
  balance: 30_000,
  isAchieved: true,
};

const camera: Goal = {
  ...turkey,
  id: "goal-3",
  title: "Камера",
  balance: 12_000,
  completed: { at: 0, by: "Ася", outcome: "cancelled" },
};

function startGoals({ choices = [] as string[] } = {}) {
  const requests: Array<{ request: string; body: unknown }> = [];
  const pending = [...choices];

  async function fetch(url: URL, init: RequestInit): Promise<Response> {
    const request = `${init.method ?? "GET"} ${url.pathname}`;
    const body: unknown = typeof init.body === "string" ? JSON.parse(init.body) : undefined;

    requests.push({ request, body });

    if (request === "GET /api/goals") {
      return Response.json({ goals: [turkey, sofa, camera], totalSaved: 70_000 });
    }

    if (request === "GET /api/family/members") {
      return Response.json([
        { id: "member-1", name: "Денис", isFamilyOwner: true, profilePicture: null },
      ]);
    }

    if (request === "POST /api/goals/goal-1/movements") {
      const { amount } = movementChange.parse(body);

      return Response.json({ ...turkey, balance: turkey.balance + amount, isAchieved: true });
    }

    return Response.json({ ...turkey, completed: { at: 0, by: "Денис", outcome: "fulfilled" } });
  }

  const client = createHttpClient({ baseUrl: "https://api.family-hub.test", fetch });
  const model = reatomGoalsScreen({
    api: createGoalsApi(client),
    members: reatomFamilyMembers(createFamilyApi(client)),
    telegram: { showPopup: async () => pending.shift() },
    self: () => "member-1",
    today: () => "2026-10-14",
    timeZone: () => "Europe/Moscow",
  });

  model.screen.subscribe(noop);
  model.movementForm.contributors.subscribe(noop);

  return { model, requests };
}

type Model = ReturnType<typeof startGoals>["model"];

async function loaded(model: Model) {
  await vi.waitFor(() => {
    expect(model.screen().kind).toBe("list");
  });
}

function opened(model: Model) {
  const screen = model.screen();

  if (screen.kind !== "goal") {
    throw new Error(`Expected a Goal, got ${screen.kind}`);
  }

  return screen;
}

beforeEach(() => {
  context.reset();
});

describe("the Goals", () => {
  test("are sorted into saving, Achieved and the archive under the total", async () => {
    const { model } = startGoals();

    await loaded(model);

    expect(model.screen()).toMatchObject({
      kind: "list",
      total: "70 000 ₽",
      active: [{ title: "Отпуск в Турции", percent: 40 }],
      achieved: [{ title: "Диван" }],
      archive: [{ title: "Камера" }],
    });
  });
});

describe("a Goal with a deadline", () => {
  test("says how much to put aside each month", async () => {
    const { model } = startGoals();

    await loaded(model);
    model.open("goal-1");

    expect(opened(model).goal.hint).toBe("~10 000 ₽ / мес");
  });
});

describe("a Contribution", () => {
  test("that reaches the target sets off the salute", async () => {
    const { model, requests } = startGoals();

    await loaded(model);
    model.open("goal-1");
    model.addMovement("contribution");
    model.movementForm.form.fields.amount.set("60000");
    model.movementForm.save();
    await vi.waitFor(() => {
      expect(model.screen().kind).toBe("goal");
    });

    expect(opened(model).isCelebrating).toBe(true);
    expect(requests.at(-1)?.body).toMatchObject({
      kind: "contribution",
      amount: 60_000,
      date: "2026-10-14",
      memberId: "member-1",
    });
  });
});

describe("closing a Goal", () => {
  test("asks first and leaves it read-only", async () => {
    const { model, requests } = startGoals({ choices: ["confirm"] });

    await loaded(model);
    model.open("goal-1");
    model.complete("fulfilled");
    await vi.waitFor(() => {
      expect(opened(model).goal.isReadOnly).toBe(true);
    });

    expect(requests.at(-1)).toEqual({
      request: "POST /api/goals/goal-1/complete",
      body: { outcome: "fulfilled" },
    });
  });
});
