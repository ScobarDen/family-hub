import { context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { petMemoChange, petProfile, type Pet, type PetList } from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client";

import { createPetsApi } from "../pets.api.ts";
import { reatomPets } from "../pets.model.ts";
import { reatomPetsScreen } from "./pets.vm.ts";

const emptyMemo = { food: null, clinic: null, important: null, updatedAt: null, updatedBy: null };

const buick: Pet = {
  id: "pet-1",
  name: "Бьюик",
  species: "dog",
  breed: "Бигль",
  sex: "male",
  birthDate: "2022-05-14",
  chipNumber: null,
  notes: null,
  archivedAt: null,
  memo: emptyMemo,
};

const kesha: Pet = { ...buick, id: "pet-2", name: "Кеша", species: "bird", breed: null };

function fakeBackend(list: PetList | Error = [buick], { failSaving = false } = {}) {
  const requests: Array<{ request: string; body: unknown }> = [];

  async function fetch(url: URL, init: RequestInit): Promise<Response> {
    const request = `${init.method ?? "GET"} ${url.pathname}`;
    const body: unknown = typeof init.body === "string" ? JSON.parse(init.body) : undefined;

    requests.push({ request, body });

    if (list instanceof Error && request === "GET /api/pets") {
      throw list;
    }

    if (request === "GET /api/pets") {
      return Response.json(list);
    }

    if (failSaving) {
      return Response.json({ code: "INVALID_REQUEST", message: "" }, { status: 503 });
    }

    if (request.endsWith("/memo")) {
      return Response.json({
        ...buick,
        memo: {
          ...petMemoChange.parse(body),
          updatedAt: Date.parse("2026-10-05T18:30:00Z"),
          updatedBy: "Ася",
        },
      });
    }

    return Response.json({ ...buick, ...petProfile.parse(body), id: "pet-new" });
  }

  return { fetch, requests };
}

function startPets(backend = fakeBackend()) {
  const client = createHttpClient({ baseUrl: "https://api.family-hub.test", fetch: backend.fetch });
  const api = createPetsApi(client);
  const pets = reatomPets({ api });
  const model = reatomPetsScreen({
    api,
    pets,
    viewer: () => ({ today: "2026-10-11", timeZone: "Europe/Moscow" }),
  });

  model.screen.subscribe(noop);

  return { model, pets, backend };
}

type Model = ReturnType<typeof startPets>["model"];

async function loaded(model: Model) {
  await vi.waitFor(() => {
    expect(model.screen().kind).not.toBe("loading");
  });
}

async function saved(model: Model) {
  await vi.waitFor(() => {
    expect(model.screen().kind).toBe("card");
  });
}

beforeEach(() => {
  context.reset();
});

describe("the pet tab", () => {
  test("opens the card of the Family's only Pet", async () => {
    const { model } = startPets();

    await loaded(model);

    expect(model.screen()).toEqual({
      kind: "card",
      card: {
        id: "pet-1",
        name: "Бьюик",
        subtitle: "Собака · Бигль · 4 года",
        facts: [
          { label: "Пол", value: "Мальчик" },
          { label: "Дата рождения", value: "14 мая 2022 г." },
        ],
        memo: { food: undefined, clinic: undefined, important: undefined, updated: undefined },
      },
    });
    expect(model.title()).toBe("Бьюик");
    expect(model.canGoBack()).toBe(false);
  });

  test("lists several Pets and opens the chosen one with a way back", async () => {
    const { model } = startPets(fakeBackend([buick, kesha]));

    await loaded(model);

    expect(model.screen()).toEqual({
      kind: "list",
      pets: [
        { id: "pet-1", name: "Бьюик", subtitle: "Собака · Бигль · 4 года" },
        { id: "pet-2", name: "Кеша", subtitle: "Птица · 4 года" },
      ],
    });
    expect(model.title()).toBe("Питомцы");

    model.open("pet-2");

    expect(model.screen()).toMatchObject({ kind: "card", card: { name: "Кеша" } });
    expect(model.canGoBack()).toBe(true);

    model.back();

    expect(model.screen().kind).toBe("list");
  });

  test("invites to add a Pet while the Family has none", async () => {
    const { model } = startPets(fakeBackend([]));

    await loaded(model);

    expect(model.screen()).toEqual({ kind: "empty" });
  });

  test("leaves archived Pets out", async () => {
    const { model } = startPets(fakeBackend([buick, { ...kesha, archivedAt: 1 }]));

    await loaded(model);

    expect(model.screen()).toMatchObject({ kind: "card", card: { name: "Бьюик" } });
  });

  test("says so when the Pets cannot load", async () => {
    const { model } = startPets(fakeBackend(new TypeError("Failed to fetch")));

    await vi.waitFor(() => {
      expect(model.screen()).toEqual({ kind: "failed" });
    });
  });
});

describe("adding a Pet", () => {
  test("sends the card and opens it", async () => {
    const { model, backend } = startPets(fakeBackend([]));

    await loaded(model);
    model.add();
    model.profileForm.form.fields.name.set("Бьюик");
    model.profileForm.form.fields.species.set("dog");
    model.profileForm.form.fields.breed.set(" ");
    model.profileForm.save();
    await saved(model);

    expect(backend.requests.at(-1)).toEqual({
      request: "POST /api/pets",
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
    expect(model.canGoBack()).toBe(false);
  });

  test("needs a name", async () => {
    const { model, backend } = startPets(fakeBackend([]));

    await loaded(model);
    model.add();
    model.profileForm.save();

    await vi.waitFor(() => {
      expect(model.profileForm.form.fields.name.validation().error).toBe("Введите имя");
    });
    expect(backend.requests.map(({ request }) => request)).toEqual(["GET /api/pets"]);
  });

  test("refuses a birth date that has not come yet", async () => {
    const { model } = startPets(fakeBackend([]));

    await loaded(model);
    model.add();
    model.profileForm.form.fields.name.set("Бьюик");
    model.profileForm.form.fields.birthDate.set("2026-12-01");
    model.profileForm.save();

    await vi.waitFor(() => {
      expect(model.profileForm.form.fields.birthDate.validation().error).toBe(
        "Дата рождения ещё не наступила",
      );
    });
  });

  test("stays on the form and says so when the server fails", async () => {
    const { model } = startPets(fakeBackend([], { failSaving: true }));

    await loaded(model);
    model.add();
    model.profileForm.form.fields.name.set("Бьюик");
    model.profileForm.save();

    await vi.waitFor(() => {
      expect(model.profileForm.failure()).toBe("Не получилось сохранить. Попробуйте ещё раз.");
    });
    expect(model.screen().kind).toBe("profile-form");
  });
});

describe("editing a Pet", () => {
  test("starts from the card's values and saves them back", async () => {
    const { model, backend } = startPets();

    await loaded(model);
    model.editProfile();

    expect(model.profileForm.form.fields.breed()).toBe("Бигль");

    model.profileForm.form.fields.breed.set("Бигль-харьер");
    model.profileForm.save();
    await saved(model);

    expect(backend.requests.at(-1)).toMatchObject({
      request: "PUT /api/pets/pet-1",
      body: { breed: "Бигль-харьер" },
    });
  });
});

describe("editing a Pet again", () => {
  test("forgets what was typed before going back", async () => {
    const { model } = startPets();

    await loaded(model);
    model.editProfile();
    model.profileForm.form.fields.breed.set("Такса");
    model.back();
    model.editProfile();

    expect(model.profileForm.form.fields.breed()).toBe("Бигль");
  });

  test("still saves after an earlier visit to the form was cancelled", async () => {
    const { model, backend } = startPets();

    await loaded(model);
    model.editProfile();
    model.back();
    model.editProfile();
    model.profileForm.save();
    await saved(model);

    expect(backend.requests.at(-1)?.request).toBe("PUT /api/pets/pet-1");
  });
});

describe("the Pet Memo", () => {
  test("shows who updated it and when after saving", async () => {
    const { model } = startPets();

    await loaded(model);
    model.editMemo();
    model.memoForm.form.fields.food.set("Acana, 2 раза в день");
    model.memoForm.save();
    await saved(model);

    expect(model.screen()).toMatchObject({
      card: {
        memo: {
          food: "Acana, 2 раза в день",
          clinic: undefined,
          updated: "Обновлено 5 октября · Ася",
        },
      },
    });
  });

  test("goes back to the card without saving", async () => {
    const { model, backend } = startPets();

    await loaded(model);
    model.editMemo();

    expect(model.canGoBack()).toBe(true);

    model.back();

    expect(model.screen().kind).toBe("card");
    expect(backend.requests).toHaveLength(1);
  });
});

describe("the tab title", () => {
  test.each([
    ["the only Pet's name", [buick], "Бьюик"],
    ["«Питомцы» for several", [buick, kesha], "Питомцы"],
    ["nothing of its own without Pets", [], undefined],
  ])("is %s", async (_case, list, title) => {
    const { pets } = startPets(fakeBackend(list));

    pets.tabTitle.subscribe(noop);

    await vi.waitFor(() => {
      expect(pets.list.data()).toBeDefined();
    });
    expect(pets.tabTitle()).toBe(title);
  });
});
