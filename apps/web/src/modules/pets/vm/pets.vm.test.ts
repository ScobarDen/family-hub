import { atom, context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import {
  petAvatar,
  petMemoChange,
  petProfile,
  photoMaxBytes,
  type Pet,
  type PetList,
} from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client";
import { PhotoTooLargeError } from "@/common/photo";

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
  avatar: null,
};

const kesha: Pet = { ...buick, id: "pet-2", name: "Кеша", species: "bird", breed: null };

const portrait = {
  id: "photo-9",
  takenAt: null,
  urls: {
    thumb: "/photos/photo-9/thumb",
    medium: "/photos/photo-9/medium",
    full: "/photos/photo-9/full",
  },
  canDelete: true,
};

function savedReply(request: string, body: unknown): Response {
  if (request === "POST /api/photos") {
    return Response.json(portrait, { status: 201 });
  }

  if (request.endsWith("/avatar")) {
    return Response.json({
      ...buick,
      avatar: petAvatar.parse(body).photoId === null ? null : portrait.urls,
    });
  }

  if (request.startsWith("DELETE")) {
    return Response.json({ status: "deleted" });
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

    return savedReply(request, body);
  }

  return { fetch, requests };
}

const buickTasks = [
  {
    key: "task-1-2026-10-01",
    taskId: "task-1",
    title: "Прививка от бешенства",
    when: "1 октября",
    isOverdue: true,
  },
  {
    key: "task-2-2026-10-20",
    taskId: "task-2",
    title: "Груминг",
    when: "20 октября",
    isOverdue: false,
  },
  { key: "task-3", taskId: "task-3", title: "К ветеринару", when: undefined, isOverdue: false },
];

function startPets(
  backend = fakeBackend(),
  { isFamilyOwner = true, photoHint = undefined as string | undefined, choices = ["confirm"] } = {},
) {
  const opened: unknown[] = [];
  const alerts: string[] = [];
  const client = createHttpClient({ baseUrl: "https://api.family-hub.test", fetch: backend.fetch });
  const api = createPetsApi(client);
  const pets = reatomPets({ api });
  const routePetId = atom<string | undefined>(undefined, "test.petRoute");
  const model = reatomPetsScreen({
    api,
    pets,
    route: {
      petId: () => routePetId(),
      open: (petId) => {
        routePetId.set(petId);
      },
      close: () => {
        routePetId.set(undefined);
      },
    },
    viewer: () => ({ today: "2026-10-11", timeZone: "Europe/Moscow" }),
    isFamilyOwner: () => isFamilyOwner,
    telegram: {
      showPopup: async () => choices.shift(),
      showAlert: (message) => {
        alerts.push(message);
      },
    },
    preparePhoto: async (file) => {
      if (file.size > photoMaxBytes) {
        throw new PhotoTooLargeError();
      }

      return { file, takenAt: null };
    },
    photoHint: () => photoHint,
    tasksOf: (petId) => (petId === "pet-1" ? buickTasks : []),
    onOpenTask: (taskId) => {
      opened.push(`task ${taskId}`);
    },
    onAddTask: (petId) => {
      opened.push(`new task for ${petId}`);
    },
  });

  model.screen.subscribe(noop);

  return { model, pets, backend, opened, alerts, routePetId };
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

    expect(model.screen()).toMatchObject({
      kind: "card",
      canDelete: false,
      archivedCount: 0,
      card: {
        id: "pet-1",
        name: "Бьюик",
        subtitle: "Собака · Бигль · 4 года",
        facts: [
          { label: "Пол", value: "Мальчик" },
          { label: "Дата рождения", value: "14 мая 2022 г." },
        ],
        memo: { food: undefined, clinic: undefined, important: undefined, updated: undefined },
        tasks: [
          {
            key: "task-1-2026-10-01",
            taskId: "task-1",
            title: "Прививка от бешенства",
            subtitle: "Просрочено · 1 октября",
            isOverdue: true,
          },
          {
            key: "task-2-2026-10-20",
            taskId: "task-2",
            title: "Груминг",
            subtitle: "20 октября",
            isOverdue: false,
          },
          {
            key: "task-3",
            taskId: "task-3",
            title: "К ветеринару",
            subtitle: undefined,
            isOverdue: false,
          },
        ],
        isArchived: false,
      },
    });
    expect(model.title()).toBe("Бьюик");
    expect(model.canGoBack()).toBe(false);
  });

  test("lists several Pets and opens the chosen one at its own address", async () => {
    const { model, routePetId } = startPets(fakeBackend([buick, kesha]));

    await loaded(model);

    expect(model.screen()).toMatchObject({
      kind: "list",
      pets: [
        { id: "pet-1", name: "Бьюик", subtitle: "Собака · Бигль · 4 года" },
        { id: "pet-2", name: "Кеша", subtitle: "Птица · 4 года" },
      ],
      archived: [],
    });
    expect(model.title()).toBe("Питомцы");

    model.open("pet-2");

    expect(model.screen()).toMatchObject({ kind: "card", card: { name: "Кеша" } });
    expect(routePetId()).toBe("pet-2");

    routePetId.set(undefined);

    expect(model.screen().kind).toBe("list");
  });

  test("keeps the only Pet's card where it is when something opens that Pet again", async () => {
    const { model, routePetId } = startPets();

    await loaded(model);
    model.open("pet-1");

    expect(routePetId()).toBeUndefined();
    expect(model.screen()).toMatchObject({ kind: "card", card: { id: "pet-1" } });
  });

  test("asks for a Pet again from an open card, unless the Family has only one", async () => {
    const several = startPets(fakeBackend([buick, kesha]));
    const single = startPets();

    await loaded(several.model);
    await loaded(single.model);
    several.model.open("pet-2");
    several.model.showChoice();
    single.model.showChoice();

    expect(several.model.screen().kind).toBe("list");
    expect(several.model.openedPetId()).toBeUndefined();
    expect(single.model.openedPetId()).toBe("pet-1");
  });

  test("invites to add a Pet while the Family has none", async () => {
    const { model } = startPets(fakeBackend([]));

    await loaded(model);

    expect(model.screen()).toEqual({ kind: "empty", archived: [] });
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

describe("«Дела» on the card", () => {
  test("opens a Task and adds a new one for this Pet through the tasks module", async () => {
    const { model, opened } = startPets();

    await loaded(model);
    model.openTask("task-2");
    model.addTask("pet-1");

    expect(opened).toEqual(["task task-2", "new task for pet-1"]);
  });
});

describe("the archive", () => {
  test("keeps archived Pets in their own part of the list, read only", async () => {
    const { model } = startPets(fakeBackend([buick, { ...kesha, archivedAt: 1 }]));

    await loaded(model);

    expect(model.screen()).toMatchObject({ kind: "card", archivedCount: 1 });

    model.showAll();

    expect(model.screen()).toMatchObject({
      kind: "list",
      pets: [{ id: "pet-1" }],
      archived: [{ id: "pet-2", name: "Кеша" }],
    });

    model.open("pet-2");

    expect(model.screen()).toMatchObject({ kind: "card", card: { isArchived: true } });
    expect(model.isOpenedPetArchived()).toBe(true);
  });

  test("lets only the Family Owner delete an archived Pet, after typing its name", async () => {
    const archivedKesha = { ...kesha, archivedAt: 1 };
    const backend = fakeBackend([buick, archivedKesha]);
    const { model } = startPets(backend);

    await loaded(model);
    model.open("pet-2");

    expect(model.screen()).toMatchObject({ canDelete: true });

    model.startDeleting();
    model.deletion.fields.petName.set("Кеша");
    model.deletePet();

    await vi.waitFor(() => {
      expect(model.screen()).toMatchObject({ kind: "card", card: { name: "Бьюик" } });
    });
    expect(backend.requests.at(-1)).toEqual({
      request: "DELETE /api/pets/pet-2",
      body: { petName: "Кеша" },
    });
  });

  test("offers no deletion to other Members", async () => {
    const { model } = startPets(fakeBackend([buick, { ...kesha, archivedAt: 1 }]), {
      isFamilyOwner: false,
    });

    await loaded(model);
    model.open("pet-2");

    expect(model.screen()).toMatchObject({ canDelete: false });
  });
});

describe("the Pet Avatar", () => {
  test("is uploaded from the card and shown on it", async () => {
    const { model, backend } = startPets();

    await loaded(model);
    model.uploadAvatar([new Blob(["buick"])]);

    await vi.waitFor(() => {
      expect(model.screen()).toMatchObject({
        card: { avatar: "https://api.family-hub.test/photos/photo-9/medium" },
      });
    });
    expect(backend.requests.map(({ request }) => request)).toContain("POST /api/photos");
    expect(backend.requests.at(-1)).toEqual({
      request: "PUT /api/pets/pet-1/avatar",
      body: { photoId: "photo-9" },
    });
  });

  test("is removed after a confirmation", async () => {
    const { model, backend } = startPets(fakeBackend([{ ...buick, avatar: portrait.urls }]), {
      choices: ["cancel", "confirm"],
    });

    await loaded(model);
    model.removeAvatar();
    model.removeAvatar();

    await vi.waitFor(() => {
      expect(model.screen()).toMatchObject({ card: { avatar: undefined } });
    });
    expect(backend.requests.filter(({ request }) => request.endsWith("/avatar"))).toEqual([
      { request: "PUT /api/pets/pet-1/avatar", body: { photoId: null } },
    ]);
  });

  test("waits for Photo Storage and stays as it is on an archived Pet", async () => {
    const { model } = startPets(fakeBackend([buick, { ...kesha, archivedAt: 1 }]), {
      photoHint: "Подключите хранилище фото",
    });

    await loaded(model);

    expect(model.avatarChange()).toEqual({ canUpload: false, hint: "Подключите хранилище фото" });

    model.open("pet-2");

    expect(model.avatarChange()).toBeUndefined();
  });

  test("says so when the photo is too large", async () => {
    const { model, backend, alerts } = startPets();

    await loaded(model);
    model.uploadAvatar([new Blob([new Uint8Array(photoMaxBytes + 1)])]);

    await vi.waitFor(() => {
      expect(alerts).toEqual(["Фото больше 10 МБ."]);
    });
    expect(backend.requests.map(({ request }) => request)).not.toContain("POST /api/photos");
  });
});
