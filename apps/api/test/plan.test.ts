import { describe, expect, test } from "vite-plus/test";

import type { Plan, PlanChange, SubplanChange } from "@family-hub/contract";

import { type TelegramUserFixture } from "./init-data.ts";
import { asya, denis, request, startWorker } from "./worker-harness.ts";

const now = "2026-10-04T09:00:00Z";
const vika = { id: 333, first_name: "Вика" };

type Worker = Awaited<ReturnType<typeof startWithFamily>>;

const bedroom: PlanChange = {
  title: "Ремонт в спальне",
  note: null,
  dueDate: "2026-11-30",
  reminder: null,
  assigneeId: null,
  visibility: "shared",
  petId: null,
  albumId: null,
};

async function startWithFamily() {
  const worker = startWorker({ now });
  const { familyId, ownerId } = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });
  const asyaId = await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });

  return Object.assign(worker, { denisId: ownerId, asyaId });
}

async function planOf(response: Response): Promise<Plan> {
  return response.json<Plan>();
}

async function createPlan(
  worker: Worker,
  user: TelegramUserFixture,
  change: Partial<PlanChange> = {},
) {
  return planOf(
    await request(worker, user, {
      method: "POST",
      path: "/api/plans",
      body: { ...bedroom, ...change },
    }),
  );
}

async function addSubplan(
  worker: Worker,
  user: TelegramUserFixture,
  { planId, ...change }: Partial<SubplanChange> & { planId: string },
) {
  return planOf(
    await request(worker, user, {
      method: "POST",
      path: `/api/plans/${planId}/subplans`,
      body: { title: "Шаг", dueDate: null, assigneeId: null, ...change },
    }),
  );
}

async function markSubplan(
  worker: Worker,
  user: TelegramUserFixture,
  {
    planId,
    subplanId,
    action,
  }: { planId: string; subplanId: string; action: "complete" | "reopen" },
) {
  return planOf(
    await request(worker, user, {
      method: "POST",
      path: `/api/plans/${planId}/subplans/${subplanId}/${action}`,
    }),
  );
}

async function plansOf(worker: Worker, user: TelegramUserFixture) {
  const response = await request(worker, user, { path: "/api/plans" });

  return response.json<Plan[]>();
}

async function planWithSteps(worker: Worker, titles: string[]) {
  let plan = await createPlan(worker, denis);

  for (const title of titles) {
    plan = await addSubplan(worker, denis, { planId: plan.id, title });
  }

  return plan;
}

describe("a Plan", () => {
  test("is written down with its Subplans for the whole Family", async () => {
    const worker = await startWithFamily();
    const created = await createPlan(worker, denis, { assigneeId: worker.asyaId });
    const withStep = await addSubplan(worker, asya, {
      planId: created.id,
      title: "Купить обои",
      dueDate: "2026-11-10",
      assigneeId: worker.denisId,
    });

    expect(withStep).toEqual({
      id: created.id,
      title: "Ремонт в спальне",
      note: null,
      pet: null,
      album: null,
      reminder: null,
      dueDate: "2026-11-30",
      assignee: { id: worker.asyaId, name: "Ася" },
      visibility: "shared",
      isOwn: false,
      completed: null,
      subplans: [
        {
          id: expect.any(String),
          title: "Купить обои",
          reminder: null,
          dueDate: "2026-11-10",
          assignee: { id: worker.denisId, name: "Денис" },
          completed: null,
        },
      ],
    });
    expect(await plansOf(worker, denis)).toEqual([{ ...withStep, isOwn: true }]);
  });

  test("is listed by due date with undated Plans last", async () => {
    const worker = await startWithFamily();

    await createPlan(worker, denis, { title: "Без срока", dueDate: null });
    await createPlan(worker, denis, { title: "Декабрь", dueDate: "2026-12-01" });
    await createPlan(worker, denis, { title: "Ноябрь", dueDate: "2026-11-01" });

    const plans = await plansOf(worker, asya);

    expect(plans.map(({ title }) => title)).toEqual(["Ноябрь", "Декабрь", "Без срока"]);
  });

  test("cannot get a Member of another Family as Assignee", async () => {
    const worker = await startWithFamily();
    const { ownerId: vikaId } = await worker.addFamily({
      name: "Соседи",
      owner: { telegramId: vika.id, name: "Вика" },
    });

    const response = await request(worker, denis, {
      method: "POST",
      path: "/api/plans",
      body: { ...bedroom, assigneeId: vikaId },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "ASSIGNEE_NOT_ALLOWED" });
  });

  test("stays out of other Families", async () => {
    const worker = await startWithFamily();

    await worker.addFamily({ name: "Соседи", owner: { telegramId: vika.id, name: "Вика" } });
    const plan = await createPlan(worker, denis);

    const completing = await request(worker, vika, {
      method: "POST",
      path: `/api/plans/${plan.id}/complete`,
    });

    expect(await plansOf(worker, vika)).toEqual([]);
    expect(completing.status).toBe(404);
  });

  test("is deleted only by its owner, Subplans included", async () => {
    const worker = await startWithFamily();
    const plan = await planWithSteps(worker, ["Обои"]);

    const refused = await request(worker, asya, {
      method: "DELETE",
      path: `/api/plans/${plan.id}`,
    });
    const deleted = await request(worker, denis, {
      method: "DELETE",
      path: `/api/plans/${plan.id}`,
    });

    expect(refused.status).toBe(403);
    expect(await deleted.json()).toEqual({ status: "deleted" });
    expect(await plansOf(worker, asya)).toEqual([]);
  });
});

describe("completing", () => {
  test("the last Subplan completes the Plan with who and when", async () => {
    const worker = await startWithFamily();
    const plan = await planWithSteps(worker, ["Обои", "Краска"]);
    const [first, second] = plan.subplans;

    await markSubplan(worker, denis, {
      planId: plan.id,
      subplanId: first?.id ?? "",
      action: "complete",
    });
    worker.clock.set("2026-10-06T12:00:00Z");
    const done = await markSubplan(worker, asya, {
      planId: plan.id,
      subplanId: second?.id ?? "",
      action: "complete",
    });

    expect(done.completed).toEqual({ at: Date.parse("2026-10-06T12:00:00Z"), by: "Ася" });
    expect(done.subplans.map(({ completed }) => completed?.by)).toEqual(["Денис", "Ася"]);
  });

  test("an unticked Subplan reopens the Plan", async () => {
    const worker = await startWithFamily();
    const plan = await planWithSteps(worker, ["Обои"]);
    const subplanId = plan.subplans[0]?.id ?? "";

    await markSubplan(worker, denis, { planId: plan.id, subplanId, action: "complete" });
    const reopened = await markSubplan(worker, asya, {
      planId: plan.id,
      subplanId,
      action: "reopen",
    });

    expect(reopened.completed).toBeNull();
  });

  test("a Plan by hand closes its open Subplans", async () => {
    const worker = await startWithFamily();
    const plan = await planWithSteps(worker, ["Обои", "Краска"]);

    const done = await planOf(
      await request(worker, asya, { method: "POST", path: `/api/plans/${plan.id}/complete` }),
    );

    expect(done.completed?.by).toBe("Ася");
    expect(done.subplans.every(({ completed }) => completed?.by === "Ася")).toBe(true);
  });

  test("a new Subplan returns a completed Plan to work", async () => {
    const worker = await startWithFamily();
    const plan = await createPlan(worker, denis);

    await request(worker, denis, { method: "POST", path: `/api/plans/${plan.id}/complete` });
    const reopened = await addSubplan(worker, asya, { planId: plan.id, title: "Плинтус" });

    expect(reopened.completed).toBeNull();
  });

  test("a completed Plan comes back to work", async () => {
    const worker = await startWithFamily();
    const plan = await createPlan(worker, denis);

    await request(worker, denis, { method: "POST", path: `/api/plans/${plan.id}/complete` });
    const reopened = await planOf(
      await request(worker, asya, { method: "POST", path: `/api/plans/${plan.id}/reopen` }),
    );

    expect(reopened.completed).toBeNull();
  });
});

describe("a Private Plan", () => {
  test("is seen and reached only by its owner", async () => {
    const worker = await startWithFamily();
    const plan = await createPlan(worker, asya, { title: "Подарок Денису", visibility: "private" });

    const edit = await request(worker, denis, {
      method: "PUT",
      path: `/api/plans/${plan.id}`,
      body: { ...bedroom, visibility: "private" },
    });

    expect(await plansOf(worker, denis)).toEqual([]);
    expect(await plansOf(worker, asya)).toEqual([
      expect.objectContaining({ title: "Подарок Денису" }),
    ]);
    expect(edit.status).toBe(404);
  });

  test("takes only its owner or nobody as Assignee, Subplans included", async () => {
    const worker = await startWithFamily();
    const refused = await request(worker, asya, {
      method: "POST",
      path: "/api/plans",
      body: { ...bedroom, visibility: "private", assigneeId: worker.denisId },
    });
    const plan = await createPlan(worker, asya, {
      visibility: "private",
      assigneeId: worker.asyaId,
    });
    const refusedStep = await request(worker, asya, {
      method: "POST",
      path: `/api/plans/${plan.id}/subplans`,
      body: { title: "Шаг", dueDate: null, assigneeId: worker.denisId },
    });

    expect(refused.status).toBe(400);
    expect(plan.assignee?.name).toBe("Ася");
    expect(refusedStep.status).toBe(400);
  });

  test("may become Shared but a Shared Plan never becomes Private", async () => {
    const worker = await startWithFamily();
    const plan = await createPlan(worker, asya, { visibility: "private" });

    const shared = await planOf(
      await request(worker, asya, {
        method: "PUT",
        path: `/api/plans/${plan.id}`,
        body: { ...bedroom, visibility: "shared" },
      }),
    );
    const back = await request(worker, asya, {
      method: "PUT",
      path: `/api/plans/${plan.id}`,
      body: { ...bedroom, visibility: "private" },
    });

    expect(shared.visibility).toBe("shared");
    expect(back.status).toBe(409);
    expect(await plansOf(worker, denis)).toHaveLength(1);
  });
});

describe("a Member leaving", () => {
  test("is cleared as Assignee from open Plans and Subplans, not from completed ones", async () => {
    const worker = await startWithFamily();
    const open = await createPlan(worker, denis, { title: "Открытый", assigneeId: worker.asyaId });
    const withStep = await addSubplan(worker, denis, {
      planId: open.id,
      assigneeId: worker.asyaId,
    });
    const done = await createPlan(worker, denis, { title: "Готовый", assigneeId: worker.asyaId });

    await request(worker, denis, { method: "POST", path: `/api/plans/${done.id}/complete` });
    await request(worker, asya, { method: "POST", path: "/api/family/leave" });

    const plans = await plansOf(worker, denis);

    expect(plans.map(({ title, assignee }) => [title, assignee?.name])).toEqual([
      ["Открытый", undefined],
      ["Готовый", "Ася"],
    ]);
    expect(plans[0]?.subplans.map(({ id, assignee }) => [id, assignee])).toEqual([
      [withStep.subplans[0]?.id, null],
    ]);
  });

  test("takes their Private Plans with them and hands their Shared ones to the Family Owner", async () => {
    const worker = await startWithFamily();

    await createPlan(worker, asya, { title: "Подарок", visibility: "private" });
    await createPlan(worker, asya, { title: "Отпуск" });
    await request(worker, asya, { method: "POST", path: "/api/family/leave" });

    expect(await plansOf(worker, denis)).toEqual([
      expect.objectContaining({ title: "Отпуск", isOwn: true }),
    ]);
  });
});

async function addBuick(worker: Worker, user: TelegramUserFixture = denis) {
  const response = await request(worker, user, {
    method: "POST",
    path: "/api/pets",
    body: {
      name: "Бьюик",
      species: "dog",
      breed: null,
      sex: null,
      birthDate: null,
      chipNumber: null,
      notes: null,
    },
  });

  return response.json<{ id: string }>();
}

describe("a Pet's Plan", () => {
  test("is linked to the Pet when created and can be unlinked", async () => {
    const worker = await startWithFamily();
    const buick = await addBuick(worker);
    const grooming = await createPlan(worker, asya, { title: "Груминг", petId: buick.id });
    const unlinked = await planOf(
      await request(worker, asya, {
        method: "PUT",
        path: `/api/plans/${grooming.id}`,
        body: { ...bedroom, title: "Груминг", petId: null },
      }),
    );

    expect(grooming.pet).toEqual({ id: buick.id, name: "Бьюик" });
    expect(unlinked.pet).toBeNull();
  });

  test("cannot be linked to a Pet of another Family", async () => {
    const worker = await startWithFamily();

    await worker.addFamily({ name: "Соседи", owner: { telegramId: vika.id, name: "Вика" } });
    const stranger = await addBuick(worker, vika);

    const response = await request(worker, denis, {
      method: "POST",
      path: "/api/plans",
      body: { ...bedroom, petId: stranger.id },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "PET_NOT_FOUND" });
  });

  test("stays in Plans without its link when the Pet is deleted", async () => {
    const worker = await startWithFamily();
    const buick = await addBuick(worker);

    await createPlan(worker, denis, { title: "Груминг", petId: buick.id });
    await worker.deletePet(buick.id);

    expect(await plansOf(worker, denis)).toEqual([
      expect.objectContaining({ title: "Груминг", pet: null }),
    ]);
  });
});
