import { context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { planChange, type FamilyMemberList, type Plan, type PlanList } from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client";
import { createFamilyApi, reatomFamilyMembers } from "@/modules/family";
import { createPetsApi, reatomPets } from "@/modules/pets";

import { createPlansApi } from "../plans.api.ts";
import { reatomPlansScreen } from "./plans.vm.ts";

const members: FamilyMemberList = [
  { id: "member-1", name: "Денис", isFamilyOwner: true },
  { id: "member-2", name: "Ася", isFamilyOwner: false },
];

const doneAt = Date.parse("2026-10-05T18:30:00Z");

const bedroom: Plan = {
  id: "plan-1",
  title: "Ремонт в спальне",
  note: null,
  pet: null,
  album: null,
  dueDate: "2026-11-30",
  reminder: null,
  assignee: { id: "member-2", name: "Ася" },
  visibility: "shared",
  isOwn: true,
  completed: null,
  subplans: [
    {
      id: "sub-1",
      title: "Купить обои",
      dueDate: "2026-12-05",
      reminder: null,
      assignee: null,
      completed: { at: doneAt, by: "Ася" },
    },
    {
      id: "sub-2",
      title: "Поклеить",
      dueDate: null,
      reminder: null,
      assignee: null,
      completed: null,
    },
  ],
};

const vacation: Plan = {
  ...bedroom,
  id: "plan-2",
  title: "Отпуск",
  dueDate: null,
  assignee: null,
  subplans: [],
};

const passport: Plan = {
  ...vacation,
  id: "plan-3",
  title: "Паспорт",
  completed: { at: doneAt, by: "Денис" },
};

type Reply = (body: unknown) => unknown;

function fakeBackend(
  list: PlanList = [bedroom, vacation, passport],
  replies: Record<string, Reply> = {},
) {
  const requests: string[] = [];
  const answers: Record<string, Reply> = {
    "GET /api/plans": () => list,
    "GET /api/family/members": () => members,
    "GET /api/pets": () => [
      {
        id: "pet-1",
        name: "Бьюик",
        species: "dog",
        breed: null,
        sex: null,
        birthDate: null,
        chipNumber: null,
        notes: null,
        archivedAt: null,
        memo: { food: null, clinic: null, important: null, updatedAt: null, updatedBy: null },
        avatar: null,
      },
    ],
    "POST /api/plans": (body) => ({ ...vacation, ...planChange.parse(body), id: "plan-new" }),
    "PUT /api/plans/plan-new": (body) => ({
      ...vacation,
      ...planChange.parse(body),
      id: "plan-new",
    }),
    "POST /api/plans/plan-1/complete": () => ({
      ...bedroom,
      completed: { at: doneAt, by: "Денис" },
    }),
    "POST /api/plans/plan-3/reopen": () => ({ ...passport, completed: null }),
    "POST /api/plans/plan-1/subplans/sub-2/complete": () => ({
      ...bedroom,
      completed: { at: doneAt, by: "Денис" },
      subplans: bedroom.subplans.map((subplan) => ({
        ...subplan,
        completed: { at: doneAt, by: "Денис" },
      })),
    }),
    "DELETE /api/plans/plan-1": () => ({ status: "deleted" }),
    ...replies,
  };

  async function fetch(url: URL, init: RequestInit): Promise<Response> {
    const request = `${init.method ?? "GET"} ${url.pathname}`;
    const body: unknown = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    const answer = answers[request];

    requests.push(request);

    if (answer === undefined) {
      return Response.json({ code: "PLAN_NOT_FOUND", message: "" }, { status: 404 });
    }

    const reply = answer(body);

    return reply instanceof Response ? reply : Response.json(reply);
  }

  return { fetch, requests };
}

function fakeTelegram(choices: string[] = []) {
  const pending = [...choices];
  const popups: string[] = [];

  return {
    async showPopup({ title }: { title?: string }) {
      popups.push(title ?? "");

      return pending.shift();
    },
    popups,
  };
}

function startPlans(backend = fakeBackend(), telegram = fakeTelegram()) {
  const client = createHttpClient({ baseUrl: "https://api.family-hub.test", fetch: backend.fetch });
  const api = createPlansApi(client);
  const openedAlbums: string[] = [];
  const model = reatomPlansScreen({
    api,
    members: reatomFamilyMembers(createFamilyApi(client)),
    pets: reatomPets({ api: createPetsApi(client) }).list,
    telegram,
    self: () => "member-1",
    viewer: () => ({ timeZone: "Europe/Moscow", today: "2026-10-16" }),
    onOpenAlbum: (albumId) => {
      openedAlbums.push(albumId);
    },
  });

  model.screen.subscribe(noop);
  model.planForm.assignees.subscribe(noop);

  return { model, backend, telegram, openedAlbums };
}

type Model = ReturnType<typeof startPlans>["model"];

async function loaded(model: Model) {
  await vi.waitFor(() => {
    expect(model.screen().kind).toBe("list");
  });
}

async function settled(model: Model) {
  await vi.waitFor(() => {
    expect(model.isChanging()).toBe(false);
  });
}

beforeEach(() => {
  context.reset();
});

describe("the list of Plans", () => {
  test("shows open Plans with due date, Assignee and progress, and folds the completed ones", async () => {
    const { model } = startPlans();

    await loaded(model);

    expect(model.screen()).toMatchObject({
      kind: "list",
      open: [
        {
          id: "plan-1",
          title: "Ремонт в спальне",
          subtitle: "до 30 ноября · Ася · 1 из 2",
          isCompleted: false,
        },
        { id: "plan-2", title: "Отпуск", subtitle: undefined, isCompleted: false },
      ],
      done: [{ id: "plan-3", title: "Паспорт", subtitle: undefined, isCompleted: true }],
      isDoneShown: false,
    });

    model.toggleDone();

    expect(model.screen()).toMatchObject({ isDoneShown: true });
  });

  test("completes a Plan from its circle without opening it", async () => {
    const { model, backend } = startPlans(
      fakeBackend(undefined, {
        "POST /api/plans/plan-2/complete": () => ({
          ...vacation,
          completed: { at: doneAt, by: "Денис" },
        }),
      }),
    );

    await loaded(model);
    model.togglePlanOf("plan-2");
    await settled(model);

    expect(backend.requests).toContain("POST /api/plans/plan-2/complete");
    expect(model.screen()).toMatchObject({
      kind: "list",
      open: [{ id: "plan-1" }],
      done: [{ id: "plan-2" }, { id: "plan-3" }],
    });
  });

  test("says in words that an open Plan is past its due date", async () => {
    const { model } = startPlans(
      fakeBackend([
        { ...bedroom, dueDate: "2026-10-12", assignee: null, subplans: [] },
        { ...vacation, dueDate: "2026-10-17" },
      ]),
    );

    await loaded(model);

    expect(model.screen()).toMatchObject({
      open: [
        { title: "Ремонт в спальне", subtitle: "Просрочено · 12 октября" },
        { title: "Отпуск", subtitle: "Завтра" },
      ],
    });
  });
});

describe("a Plan", () => {
  test("shows its progress and warns about a Subplan due after it", async () => {
    const { model } = startPlans();

    await loaded(model);
    model.open("plan-1");

    expect(model.title()).toBe("Ремонт в спальне");
    expect(model.screen()).toMatchObject({
      kind: "plan",
      plan: {
        facts: "до 30 ноября · Ася",
        progress: "1 из 2",
        completed: undefined,
        subplans: [
          {
            title: "Купить обои",
            isCompleted: true,
            subtitle: expect.stringContaining("позже срока плана"),
          },
          {
            title: "Поклеить",
            isCompleted: false,
            subtitle: expect.not.stringContaining("позже срока плана"),
          },
        ],
      },
    });
    expect(model.canGoBack()).toBe(true);

    model.back();

    expect(model.screen().kind).toBe("list");
  });

  test("is completed with its last Subplan as the server answers", async () => {
    const { model, backend } = startPlans();

    await loaded(model);
    model.open("plan-1");
    model.toggleSubplan("sub-2");
    await settled(model);

    expect(backend.requests).toContain("POST /api/plans/plan-1/subplans/sub-2/complete");
    expect(model.screen()).toMatchObject({
      plan: { isCompleted: true, completed: "Выполнено 5 октября · Денис", progress: "2 из 2" },
    });
  });

  test("asks before completing open Subplans with it", async () => {
    const { model, backend, telegram } = startPlans(fakeBackend(), fakeTelegram(["confirm"]));

    await loaded(model);
    model.open("plan-1");
    model.togglePlan();
    await settled(model);

    expect(telegram.popups).toEqual(["Завершить план?"]);
    expect(backend.requests).toContain("POST /api/plans/plan-1/complete");
  });

  test("stays open when the question is dismissed", async () => {
    const { model, backend } = startPlans();

    await loaded(model);
    model.open("plan-1");
    model.togglePlan();
    await settled(model);

    expect(backend.requests).not.toContain("POST /api/plans/plan-1/complete");
  });

  test("comes back to work from «Выполненные» without a question", async () => {
    const { model, backend, telegram } = startPlans();

    await loaded(model);
    model.open("plan-3");
    model.togglePlan();
    await settled(model);

    expect(telegram.popups).toEqual([]);
    expect(backend.requests).toContain("POST /api/plans/plan-3/reopen");
    expect(model.screen()).toMatchObject({ plan: { isCompleted: false } });
  });

  test("is deleted by its owner after a confirmation", async () => {
    const { model, backend } = startPlans(fakeBackend(), fakeTelegram(["confirm"]));

    await loaded(model);
    model.open("plan-1");
    model.removePlan();
    await vi.waitFor(() => {
      expect(model.screen().kind).toBe("list");
    });

    expect(backend.requests).toContain("DELETE /api/plans/plan-1");
    expect(model.screen()).toMatchObject({ open: [{ id: "plan-2" }] });
  });

  test("says so when the server fails", async () => {
    const { model } = startPlans(
      fakeBackend(undefined, {
        "POST /api/plans/plan-1/subplans/sub-2/complete": () => Response.json({}, { status: 500 }),
      }),
    );

    await loaded(model);
    model.open("plan-1");
    model.toggleSubplan("sub-2");
    await settled(model);

    expect(model.failure()).toBe("Не получилось сохранить. Попробуйте ещё раз.");
  });
});

describe("the Plan form", () => {
  test("adds a Plan and opens it", async () => {
    const { model, backend } = startPlans();

    await loaded(model);
    model.add();
    model.planForm.form.fields.title.set("Купить диван");
    model.planForm.save();
    await vi.waitFor(() => {
      expect(model.screen().kind).toBe("plan");
    });

    expect(backend.requests).toContain("POST /api/plans");
    expect(model.title()).toBe("Купить диван");
  });

  test("keeps a deadline Reminder only while the Plan has a due date", async () => {
    const { model } = startPlans();

    await loaded(model);
    model.add();
    model.planForm.form.fields.title.set("Записаться к стоматологу");
    model.planForm.form.fields.dueDate.set("2026-11-01");
    model.planForm.form.fields.reminder.set("1w");
    model.planForm.save();
    await vi.waitFor(() => {
      expect(model.screen().kind).toBe("plan");
    });
    model.edit();

    expect(model.planForm.form.fields.reminder()).toBe("1w");

    model.planForm.form.fields.dueDate.set("");
    model.planForm.save();
    await vi.waitFor(() => {
      expect(model.screen().kind).toBe("plan");
    });
    model.edit();

    expect(model.planForm.form.fields.reminder()).toBe("");
  });

  test("offers only the owner or nobody as Assignee of a Private Plan", async () => {
    const { model } = startPlans();

    await loaded(model);
    model.add();
    model.planForm.form.fields.assigneeId.set("member-2");
    await vi.waitFor(() => {
      expect(model.planForm.assignees()).toHaveLength(3);
    });

    model.planForm.chooseVisibility("private");

    expect(model.planForm.assignees()).toEqual([
      { value: "", title: "Никто" },
      { value: "member-1", title: "Денис" },
    ]);
    expect(model.planForm.form.fields.assigneeId()).toBe("");
  });

  test("keeps a Shared Plan Shared", async () => {
    const { model } = startPlans();

    await loaded(model);
    model.open("plan-1");
    model.edit();

    expect(model.planForm.canChooseVisibility()).toBe(false);
    expect(model.planForm.form.fields.title()).toBe("Ремонт в спальне");
  });
});

describe("the Subplan form", () => {
  test("warns when the step is due after its Plan", async () => {
    const { model } = startPlans();

    await loaded(model);
    model.open("plan-1");
    model.addSubplan();
    model.subplanForm.form.fields.dueDate.set("2026-12-10");

    expect(model.subplanForm.warning()).toBe("Позже срока плана");

    model.subplanForm.form.fields.dueDate.set("2026-11-10");

    expect(model.subplanForm.warning()).toBeUndefined();
  });
});

describe("a Pet's Plans", () => {
  test("are the open Plans linked to it", async () => {
    const grooming: Plan = {
      ...vacation,
      id: "plan-4",
      title: "Груминг",
      pet: { id: "pet-1", name: "Бьюик" },
    };
    const done: Plan = { ...grooming, id: "plan-5", completed: { at: doneAt, by: "Ася" } };
    const { model } = startPlans(fakeBackend([bedroom, grooming, done]));

    await loaded(model);

    expect(model.openPlansOf("pet-1").map(({ id }) => id)).toEqual(["plan-4"]);
  });

  test("start from the pet card with the Pet already chosen", async () => {
    const { model } = startPlans();

    model.planForm.pets.subscribe(noop);
    await loaded(model);
    model.addForPet("pet-1");

    expect(model.screen()).toEqual({ kind: "plan-form", isCreating: true });
    expect(model.planForm.form.fields.petId()).toBe("pet-1");
    await vi.waitFor(() => {
      expect(model.planForm.pets()).toEqual([
        { value: "", title: "Без питомца" },
        { value: "pet-1", title: "Бьюик" },
      ]);
    });
  });
});

describe("a trip's Plan", () => {
  test("shows a strip of its Album and opens the Album itself", async () => {
    const kazan: Plan = {
      ...vacation,
      album: {
        id: "album-1",
        title: "Казань",
        photoCount: 12,
        photos: [
          {
            id: "photo-1",
            takenAt: null,
            urls: { thumb: "/photos/photo-1/thumb", medium: "/m", full: "/f" },
            canDelete: true,
          },
        ],
      },
    };
    const { model, openedAlbums } = startPlans(fakeBackend([kazan]));

    await loaded(model);
    model.open(kazan.id);

    expect(model.screen()).toMatchObject({
      kind: "plan",
      plan: {
        album: {
          photoCount: 12,
          photos: [{ urls: { thumb: "https://api.family-hub.test/photos/photo-1/thumb" } }],
        },
      },
    });

    model.openAlbum("album-1");

    expect(openedAlbums).toEqual(["album-1"]);
  });
});
