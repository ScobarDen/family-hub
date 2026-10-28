import { context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { movementChange, type Goal } from "@family-hub/contract";

import { reatomDeviceCache } from "@/common/device-cache";
import { createHttpClient } from "@/common/http-client";
import {
  fakeDeviceStorage,
  fakeHaptics,
  type FakeDeviceStorage,
  fakeWindow,
} from "@/common/telegram";
import { createFamilyApi, reatomFamilyMembers } from "@/modules/family";

import { createGoalsApi } from "../goals.api.ts";
import { totalOf } from "../goals.model.ts";
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
  movements: [
    {
      id: "movement-1",
      kind: "contribution",
      amount: 40_000,
      date: "2026-10-01",
      member: { id: "member-1", name: "Денис" },
      recordedBy: { id: "member-1", name: "Денис" },
      comment: null,
      isOwn: true,
    },
  ],
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

type Launch = {
  choices?: string[];
  device?: FakeDeviceStorage;
  goals?: Goal[];
  answered?: Promise<void>;
  moving?: "refused" | "unreachable" | Promise<void>;
};

type Moving = NonNullable<Launch["moving"]>;

async function movementReply(
  { request, body }: { request: string; body: unknown },
  moving: Moving,
): Promise<Response> {
  if (moving === "unreachable") {
    throw new TypeError("Failed to fetch");
  }

  if (moving === "refused") {
    return Response.json({ code: "BALANCE_NEGATIVE", message: "" }, { status: 409 });
  }

  await moving;

  if (request.startsWith("DELETE")) {
    return Response.json({ ...turkey, balance: 0, movements: [], shares: [] });
  }

  const { amount } = movementChange.parse(body);

  return Response.json({ ...turkey, balance: turkey.balance + amount, isAchieved: true });
}

function startGoals({
  choices = [],
  device = fakeDeviceStorage(),
  goals = [turkey, sofa, camera],
  answered = Promise.resolve(),
  moving = Promise.resolve(),
}: Launch = {}) {
  const requests: Array<{ request: string; body: unknown }> = [];
  const pending = [...choices];

  async function fetch(url: URL, init: RequestInit): Promise<Response> {
    const request = `${init.method ?? "GET"} ${url.pathname}`;
    const body: unknown = typeof init.body === "string" ? JSON.parse(init.body) : undefined;

    requests.push({ request, body });

    if (request === "GET /api/goals") {
      await answered;

      return Response.json({ goals, totalSaved: totalOf(goals) });
    }

    if (request === "GET /api/family/members") {
      return Response.json([
        { id: "member-1", name: "Денис", isFamilyOwner: true, profilePicture: null },
      ]);
    }

    if (request.includes("/movements")) {
      return movementReply({ request, body }, moving);
    }

    return Response.json({ ...turkey, completed: { at: 0, by: "Денис", outcome: "fulfilled" } });
  }

  const client = createHttpClient({ baseUrl: "https://api.family-hub.test", fetch });
  const haptics = fakeHaptics();
  const model = reatomGoalsScreen({
    api: createGoalsApi(client),
    members: reatomFamilyMembers(createFamilyApi(client)),
    telegram: { ...fakeWindow(), showPopup: async () => pending.shift(), haptics },
    self: () => "member-1",
    today: () => "2026-10-14",
    timeZone: () => "Europe/Moscow",
    deviceCache: reatomDeviceCache(device.deviceStorage),
  });

  model.screen.subscribe(noop);
  model.movementForm.contributors.subscribe(noop);

  return { model, requests, felt: haptics.felt };
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
  test("that reaches the target sets off the salute with a single pulse", async () => {
    const { model, requests, felt } = startGoals();

    await loaded(model);
    model.open("goal-1");
    model.addMovement("contribution");
    model.movementForm.form.fields.amount.set("60000");
    model.movementForm.save();
    await vi.waitFor(() => {
      expect(model.screen().kind).toBe("goal");
    });

    expect(opened(model).isCelebrating).toBe(true);
    expect(felt).toEqual(["success"]);
    expect(requests.at(-1)?.body).toMatchObject({
      kind: "contribution",
      amount: 60_000,
      date: "2026-10-14",
      memberId: "member-1",
    });
  });
});

describe("a Movement with a field to fix", () => {
  test("stays on the form with an error pulse", async () => {
    const { model, requests, felt } = startGoals();

    await loaded(model);
    model.open("goal-1");
    model.addMovement("contribution");
    model.movementForm.save();

    await vi.waitFor(() => {
      expect(felt).toEqual(["error"]);
    });
    expect(model.screen().kind).toBe("movement-form");
    expect(requests.filter(({ request }) => request.includes("/movements"))).toEqual([]);
  });
});

function balanceOf(model: Model) {
  const { progress, movements } = opened(model).goal;

  return { progress: progress.replaceAll(/\s/gu, " "), movements: movements.length };
}

async function addMovement(model: Model, kind: "contribution" | "withdrawal", amount: string) {
  await loaded(model);
  model.open("goal-1");
  model.addMovement(kind);
  model.movementForm.form.fields.amount.set(amount);
  model.movementForm.save();
  await vi.waitFor(() => {
    expect(model.screen().kind).toBe("goal");
  });
}

const moves = [
  {
    name: "a Contribution",
    act: async (model: Model) => addMovement(model, "contribution", "60000"),
    after: { progress: "100 000 ₽ из 100 000 ₽ · 100%", movements: 2 },
    tap: "success",
  },
  {
    name: "a Withdrawal",
    act: async (model: Model) => addMovement(model, "withdrawal", "10000"),
    after: { progress: "30 000 ₽ из 100 000 ₽ · 30%", movements: 2 },
    tap: "success",
  },
  {
    name: "deleting a Movement",
    choices: ["confirm"],
    act: async (model: Model) => {
      await loaded(model);
      model.open("goal-1");
      model.removeMovement("movement-1");
    },
    after: { progress: "0 ₽ из 100 000 ₽ · 0%", movements: 0 },
    tap: "warning",
  },
];

const before = { progress: "40 000 ₽ из 100 000 ₽ · 40%", movements: 1 };

describe.each(moves)("$name", ({ act, after, choices, tap }) => {
  test("changes the Balance before the server answers, with one pulse at the tap", async () => {
    const { model, felt } = startGoals({ choices, moving: new Promise(noop) });

    await act(model);
    await vi.waitFor(() => {
      expect(balanceOf(model)).toEqual(after);
    });

    expect(model.failure()).toBeUndefined();
    expect(felt).toEqual([tap]);
  });

  test.each([
    {
      moving: "refused" as const,
      said: "Не получилось сохранить. Баланс цели не может уйти в минус.",
    },
    { moving: "unreachable" as const, said: "Нет связи, не сохранилось" },
  ])("rolls back with the failure bar when $moving", async ({ moving, said }) => {
    const { model, felt } = startGoals({ choices, moving });

    await act(model);
    await vi.waitFor(() => {
      expect(model.failure()).toBe(said);
    });

    expect(balanceOf(model)).toEqual(before);
    expect(felt).toEqual([tap, "error"]);
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

describe("launching from the device cache", () => {
  test("shows the Goals of the last launch until the fresh ones arrive", async () => {
    const device = fakeDeviceStorage();

    await loaded(startGoals({ device }).model);
    await settle();
    context.reset();
    let answer = noop;
    const { model } = startGoals({
      device,
      goals: [sofa],
      answered: new Promise((resolve) => {
        answer = resolve;
      }),
    });

    await vi.waitFor(() => {
      expect(model.screen()).toMatchObject({ active: [{ title: "Отпуск в Турции" }] });
    });
    answer();
    await vi.waitFor(() => {
      expect(model.screen()).toMatchObject({ active: [], achieved: [{ title: "Диван" }] });
    });
  });
});

async function settle(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
