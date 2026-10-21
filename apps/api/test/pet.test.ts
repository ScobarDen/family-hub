import { describe, expect, test } from "vite-plus/test";

import type { Pet } from "@family-hub/contract";

import { signInitData, type TelegramUserFixture } from "./init-data.ts";
import { startWorker } from "./worker-harness.ts";

const now = "2026-10-04T09:00:00Z";
const denis = { id: 111, first_name: "Денис" };
const asya = { id: 222, first_name: "Ася" };
const vika = { id: 333, first_name: "Вика" };

type Worker = ReturnType<typeof startWorker>;

const buick = {
  name: "Бьюик",
  species: "dog",
  breed: "Бигль",
  sex: "male",
  birthDate: "2022-05-14",
  chipNumber: "643094100123456",
  notes: "Боится пылесоса",
};

async function call(
  worker: Worker,
  user: TelegramUserFixture,
  { method, path, body }: { method: string; path: string; body?: unknown },
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

async function addPet(worker: Worker, user: TelegramUserFixture, body: unknown = buick) {
  return call(worker, user, { method: "POST", path: "/api/pets", body });
}

async function addedPet(worker: Worker, user: TelegramUserFixture): Promise<Pet> {
  const response = await addPet(worker, user);

  return response.json<Pet>();
}

async function petsOf(worker: Worker, user: TelegramUserFixture) {
  const response = await call(worker, user, { method: "GET", path: "/api/pets" });

  return response.json<Pet[]>();
}

async function startWithFamily() {
  const worker = startWorker({ now });
  const { familyId } = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });

  const asyaId = await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });

  return Object.assign(worker, { asyaId });
}

describe("adding a Pet", () => {
  test("keeps its card for the whole Family", async () => {
    const worker = await startWithFamily();

    const response = await addPet(worker, asya);
    const created = await response.json<Pet>();

    expect(response.status).toBe(201);
    expect(created).toEqual({
      id: expect.any(String),
      ...buick,
      archivedAt: null,
      memo: { food: null, clinic: null, important: null, updatedAt: null, updatedBy: null },
    });
    expect(await petsOf(worker, denis)).toEqual([created]);
  });

  test("needs only a name and a species", async () => {
    const worker = await startWithFamily();

    const response = await addPet(worker, denis, {
      name: "Кеша",
      species: "bird",
      breed: "",
      sex: null,
      birthDate: null,
      chipNumber: "  ",
      notes: null,
    });

    expect(await response.json()).toMatchObject({ name: "Кеша", breed: null, chipNumber: null });
  });

  test.each([
    ["without a name", { ...buick, name: "  " }],
    ["of an unknown species", { ...buick, species: "dragon" }],
    ["with a birth date that is not a date", { ...buick, birthDate: "14.05.2022" }],
  ])("is refused %s", async (_case, body) => {
    const worker = await startWithFamily();

    const response = await addPet(worker, denis, body);

    expect(response.status).toBe(400);
    expect(await petsOf(worker, denis)).toEqual([]);
  });

  test("stays out of other Families", async () => {
    const worker = await startWithFamily();

    await worker.addFamily({ name: "Соседи", owner: { telegramId: vika.id, name: "Вика" } });
    await addPet(worker, denis);

    expect(await petsOf(worker, vika)).toEqual([]);
  });
});

describe("editing a Pet", () => {
  test("lets any Member change the card", async () => {
    const worker = await startWithFamily();
    const { id } = await addedPet(worker, denis);

    const response = await call(worker, asya, {
      method: "PUT",
      path: `/api/pets/${id}`,
      body: { ...buick, breed: "Бигль-харьер", notes: null },
    });

    expect(await response.json()).toMatchObject({ breed: "Бигль-харьер", notes: null });
  });

  test("cannot reach a Pet of another Family", async () => {
    const worker = await startWithFamily();

    await worker.addFamily({ name: "Соседи", owner: { telegramId: vika.id, name: "Вика" } });
    const { id } = await addedPet(worker, vika);

    const response = await call(worker, denis, {
      method: "PUT",
      path: `/api/pets/${id}`,
      body: { ...buick, name: "Чужой" },
    });

    expect(response.status).toBe(404);
    expect(await petsOf(worker, vika)).toEqual([expect.objectContaining({ name: "Бьюик" })]);
  });
});

describe("the Pet Memo", () => {
  test("shows who updated it and when", async () => {
    const worker = await startWithFamily();
    const { id } = await addedPet(worker, denis);

    worker.clock.set("2026-10-05T18:30:00Z");
    const response = await call(worker, asya, {
      method: "PUT",
      path: `/api/pets/${id}/memo`,
      body: { food: "Acana, 2 раза в день", clinic: "Бэст, ул. Ленина 5", important: "" },
    });

    const saved = await response.json<Pet>();

    expect(saved.memo).toEqual({
      food: "Acana, 2 раза в день",
      clinic: "Бэст, ул. Ленина 5",
      important: null,
      updatedAt: Date.parse("2026-10-05T18:30:00Z"),
      updatedBy: "Ася",
    });
  });

  test("keeps the author's name after they leave the Family", async () => {
    const worker = await startWithFamily();
    const { asyaId } = worker;
    const { id } = await addedPet(worker, denis);

    await call(worker, asya, {
      method: "PUT",
      path: `/api/pets/${id}/memo`,
      body: { food: "Acana", clinic: null, important: null },
    });
    await worker.leaveFamily(asyaId);
    const [buickNow] = await petsOf(worker, denis);

    expect(buickNow?.memo.updatedBy).toBe("Ася");
  });

  test("leaves the card's other fields alone", async () => {
    const worker = await startWithFamily();
    const { id } = await addedPet(worker, denis);

    await call(worker, asya, {
      method: "PUT",
      path: `/api/pets/${id}/memo`,
      body: { food: "Acana", clinic: null, important: null },
    });

    expect(await petsOf(worker, denis)).toEqual([expect.objectContaining(buick)]);
  });

  test("cannot reach a Pet of another Family", async () => {
    const worker = await startWithFamily();

    await worker.addFamily({ name: "Соседи", owner: { telegramId: vika.id, name: "Вика" } });
    const { id } = await addedPet(worker, vika);

    const response = await call(worker, denis, {
      method: "PUT",
      path: `/api/pets/${id}/memo`,
      body: { food: "Чужой корм", clinic: null, important: null },
    });

    expect(response.status).toBe(404);
  });
});
