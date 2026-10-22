import { atom, context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type {
  CareEntry,
  CommandPhrase,
  DueDateItem,
  ExpenseSummary,
  Photo,
} from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client";
import { PhotoTooLargeError } from "@/common/photo";

import { createCareApi } from "../care.api.ts";
import { reatomCare } from "./care.vm.ts";

const entries: CareEntry[] = [
  {
    id: "entry-3",
    petId: "pet-1",
    occurredAt: Date.parse("2026-10-10T09:00:00Z"),
    note: null,
    details: { kind: "weight", weightKg: 12.8 },
    author: "Ася",
    photos: [],
  },
  {
    id: "entry-2",
    petId: "pet-1",
    occurredAt: Date.parse("2026-10-02T15:00:00Z"),
    note: "Перенёс спокойно",
    details: {
      kind: "vet_visit",
      reason: "Хромает",
      cost: { amount: 2500, category: "vet" },
      dueDate: null,
    },
    author: "Денис",
    photos: [],
  },
  {
    id: "entry-1",
    petId: "pet-1",
    occurredAt: Date.parse("2026-05-01T09:00:00Z"),
    note: null,
    details: { kind: "weight", weightKg: 12.1 },
    author: "Денис",
    photos: [],
  },
];

const buickVaccine: CareEntry = {
  id: "entry-7",
  petId: "pet-2",
  occurredAt: Date.parse("2025-10-02T15:00:00Z"),
  note: null,
  details: {
    kind: "vaccination",
    vaccine: "Нобивак DHPPi",
    cost: { amount: 1800, category: "vet" },
    dueDate: "2026-10-02",
  },
  author: "Ася",
  photos: [],
};

const month: ExpenseSummary = {
  total: 6500,
  byCategory: [
    { category: "food", amount: 4000 },
    { category: "vet", amount: 2500 },
  ],
  entries: [],
};

const walk: Photo = {
  id: "photo-1",
  takenAt: null,
  urls: {
    thumb: "/photos/photo-1/thumb?exp=1&sig=a",
    medium: "/photos/photo-1/medium?exp=1&sig=b",
    full: "/photos/photo-1/full?exp=1&sig=c",
  },
  canDelete: true,
};

const vetVisitDue: DueDateItem = {
  entryId: "entry-2",
  kind: "vet_visit",
  label: "Визит к ветеринару",
  title: "Визит к ветеринару — Бьюик",
  dueDate: "2026-11-02",
  isOverdue: false,
};

const saidThisMorning: CommandPhrase = {
  saidAt: Date.parse("2026-10-11T06:00:00Z"),
  timeZone: "Europe/Moscow",
};

const answers: Partial<Record<string, () => Response>> = {
  "POST /api/photos": () => Response.json(walk, { status: 201 }),
  "GET /api/care-entries/entry-7": () => Response.json(buickVaccine),
  "GET /api/pets/pet-2/care-entries": () => Response.json([buickVaccine]),
  "GET /api/pets/pet-1/due-dates": () => Response.json([vetVisitDue]),
};

function fakeBackend() {
  const requests: Array<{ request: string; body: unknown }> = [];

  async function fetch(url: URL, init: RequestInit): Promise<Response> {
    const request = `${init.method ?? "GET"} ${url.pathname}`;
    const body: unknown = typeof init.body === "string" ? JSON.parse(init.body) : undefined;

    requests.push({ request, body });

    if (request.endsWith("/expenses")) {
      return Response.json(month);
    }

    if (request.startsWith("DELETE")) {
      return Response.json({ status: "deleted" });
    }

    const answer = answers[request];

    if (answer !== undefined) {
      return answer();
    }

    if (request.startsWith("GET /api/care-entries/")) {
      return Response.json(
        { code: "CARE_ENTRY_NOT_FOUND", message: "No such Care Entry in the Family" },
        { status: 404 },
      );
    }

    return request === "GET /api/pets/pet-1/care-entries"
      ? Response.json(entries)
      : Response.json({ ...entries[0], details: { kind: "note" } }, { status: 201 });
  }

  return { fetch, requests };
}

const tooLarge = new Blob(["too large"]);
// A connected Photo Storage leaves nothing to explain.
const connectedStorage: string | undefined = undefined;

function startCare(choices: string[] = []) {
  const backend = fakeBackend();
  const avatars: string[] = [];
  const client = createHttpClient({ baseUrl: "https://api.family-hub.test", fetch: backend.fetch });
  const pending = [...choices];
  const openedPet = atom<string | undefined>("pet-1", "test.openedPet");
  const isArchived = atom(false, "test.isArchived");
  const model = reatomCare({
    api: createCareApi(client),
    petId: () => openedPet(),
    today: () => "2026-10-11",
    now: () => "2026-10-11T18:30",
    timeZone: () => "Europe/Moscow",
    telegram: { showPopup: async () => pending.shift() },
    isReadOnly: () => isArchived(),
    preparePhoto: async (file) => {
      if (file === tooLarge) {
        throw new PhotoTooLargeError();
      }

      return { file, takenAt: Date.parse("2026-08-01T12:00:00Z") };
    },
    photoHint: () => connectedStorage,
    onMakeAvatar: (photoId) => {
      avatars.push(photoId);
    },
    onOpenPet: (petId) => {
      openedPet.set(petId);
    },
  });

  model.journal.subscribe(noop);
  model.month.subscribe(noop);
  model.weight.subscribe(noop);

  return { model, backend, avatars, openedPet, isArchived };
}

type Model = ReturnType<typeof startCare>["model"];

async function loaded(model: Model) {
  await vi.waitFor(() => {
    expect(model.journal()).toHaveLength(3);
    expect(model.month()).toBeDefined();
  });
}

beforeEach(() => {
  context.reset();
});

describe("the journal", () => {
  test("shows each entry with its day, author and cost", async () => {
    const { model } = startCare();

    await loaded(model);

    expect(model.journal()[1]).toEqual({
      id: "entry-2",
      title: "Ветеринар: Хромает",
      subtitle: "2 октября · Денис · 2 500 ₽",
      note: "Перенёс спокойно",
      photos: [],
    });
  });
});

describe("«Скоро» on the pet card", () => {
  test("names each open Due Date the way the server labels it", async () => {
    const { model } = startCare();

    model.dueSources.subscribe(noop);

    await vi.waitFor(() => {
      expect(model.dueSources()).toEqual([
        { id: "entry-2", title: "Визит к ветеринару", dueDate: "2026-11-02", kind: "due" },
      ]);
    });
  });
});

describe("«Траты за месяц»", () => {
  test("asks for this month in the viewer's zone and shows it by category", async () => {
    const { model, backend } = startCare();

    await loaded(model);

    expect(backend.requests.map(({ request }) => request)).toContain(
      "GET /api/pets/pet-1/expenses",
    );
    expect(model.month()).toEqual({
      total: "6 500 ₽",
      rows: [
        { title: "Корм", amount: "4 000 ₽" },
        { title: "Ветеринар", amount: "2 500 ₽" },
      ],
    });
  });
});

describe("the weight chart", () => {
  test("shows the last three months by default and everything on demand", async () => {
    const { model } = startCare();

    await loaded(model);

    expect(model.weight().points.map(({ kg }) => kg)).toEqual([12.8]);

    model.chooseWeightRange("all");

    expect(model.weight()).toEqual({
      range: "all",
      points: [
        { at: Date.parse("2026-05-01T09:00:00Z"), kg: 12.1, label: "1 мая" },
        { at: Date.parse("2026-10-10T09:00:00Z"), kg: 12.8, label: "10 октября" },
      ],
    });
  });

  test("leads with the last weighing and its change over the shown range", async () => {
    const { model } = startCare();

    await loaded(model);

    expect(model.weightSummary()).toEqual({ latest: "12,8 кг", change: undefined });

    model.chooseWeightRange("all");

    expect(model.weightSummary()).toEqual({ latest: "12,8 кг", change: "+0,7 кг с 1 мая" });
  });
});

describe("the entry form", () => {
  test("records a weight at the current minute and goes back to the card", async () => {
    const { model, backend } = startCare();

    await loaded(model);
    model.add("weight");
    model.form.form.fields.weightKg.set("12,6");
    model.form.save();
    await vi.waitFor(() => {
      expect(model.canGoBack()).toBe(false);
    });

    expect(backend.requests.find(({ request }) => request.startsWith("POST"))?.body).toEqual({
      occurredAt: Date.parse("2026-10-11T15:30:00Z"),
      note: null,
      details: { kind: "weight", weightKg: 12.6 },
      photoIds: [],
    });
  });

  test("names the field to fix when the contract refuses the details", async () => {
    const { model, backend } = startCare();

    await loaded(model);
    model.add("weight");
    model.form.form.fields.weightKg.set("12,45");
    model.form.save();

    await vi.waitFor(() => {
      expect(model.form.form.fields.weightKg.validation().error).toBe(
        "Вес в килограммах, с шагом 0,1",
      );
    });
    expect(backend.requests.some(({ request }) => request.startsWith("POST"))).toBe(false);
  });

  test("starts from an entry's values when it is opened", async () => {
    const { model } = startCare();

    await loaded(model);
    model.edit("entry-2");

    expect(model.title()).toBe("Запись");
    expect(model.form.form.fields.reason()).toBe("Хромает");
    expect(model.form.form.fields.costAmount()).toBe("2500");
    expect(model.form.form.fields.occurredAt()).toBe("2026-10-02T18:00");
  });

  test("deletes an entry after a confirmation", async () => {
    const { model, backend } = startCare(["delete"]);

    await loaded(model);
    model.edit("entry-2");
    model.remove();

    await vi.waitFor(() => {
      expect(model.canGoBack()).toBe(false);
    });
    expect(backend.requests.map(({ request }) => request)).toContain(
      "DELETE /api/care-entries/entry-2",
    );
  });
});

describe("a Care Entry's photos", () => {
  test("go up as they are picked and are linked on saving", async () => {
    const { model, backend } = startCare();

    await loaded(model);
    model.add("note");
    model.attachments.add([new Blob(["walk"]), tooLarge]);
    await vi.waitFor(() => {
      expect(model.attachments.isUploading()).toBe(false);
    });

    expect(model.attachments.items()).toMatchObject([
      {
        status: "ready",
        photo: { urls: { thumb: "https://api.family-hub.test/photos/photo-1/thumb?exp=1&sig=a" } },
      },
      { status: "failed", reason: "Фото больше 10 МБ" },
    ]);

    model.form.form.fields.note.set("Гуляли в парке");
    model.form.save();
    await vi.waitFor(() => {
      expect(model.canGoBack()).toBe(false);
    });

    expect(
      backend.requests.find(({ request }) => request === "POST /api/pets/pet-1/care-entries")?.body,
    ).toMatchObject({ photoIds: ["photo-1"] });
  });

  test("open full screen, become the avatar and are deleted after a confirmation", async () => {
    const { model, backend, avatars } = startCare(["delete"]);

    model.viewer.open([walk], "photo-1");
    model.viewer.pick();
    model.viewer.remove();
    await vi.waitFor(() => {
      expect(model.viewer.current()).toBeUndefined();
    });

    expect(avatars).toEqual(["photo-1"]);
    expect(backend.requests.map(({ request }) => request)).toContain("DELETE /api/photos/photo-1");
  });
});

describe("a Care Entry draft opened by «Изменить»", () => {
  test("fills the form from yesterday at the time of day it was said and saves it for the open Pet", async () => {
    const { model, backend } = startCare();

    await loaded(model);
    model.editDraft({
      draftId: "draft-3",
      draft: {
        kind: "care_entry",
        petId: "pet-1",
        date: "2026-10-10",
        time: null,
        note: null,
        details: {
          kind: "vaccination",
          vaccine: "Бешенство",
          cost: { amount: 1800, category: "vet" },
          dueDate: "2027-10-10",
        },
        missing: [],
        ambiguities: [],
      },
      phrase: saidThisMorning,
    });

    expect(model.screen()).toEqual({ kind: "form", isCreating: true });
    expect(model.form.kind()).toBe("vaccination");
    expect(model.form.form.fields.occurredAt()).toBe("2026-10-10T09:00");
    expect(model.form.form.fields.name()).toBe("Бешенство");
    expect(model.form.form.fields.costAmount()).toBe("1800");
    expect(model.form.form.fields.dueDate()).toBe("2027-10-10");

    model.form.save();

    await vi.waitFor(() => {
      expect(
        backend.requests.find(({ request }) => request === "POST /api/pets/pet-1/care-entries")
          ?.body,
      ).toMatchObject({
        occurredAt: Date.parse("2026-10-10T06:00:00Z"),
        details: { kind: "vaccination", vaccine: "Бешенство" },
        photoIds: [],
      });
    });
  });

  test("shows the moment of a phrase said in another zone on the viewer's own clock", async () => {
    const { model } = startCare();

    await loaded(model);
    model.editDraft({
      draftId: "draft-5",
      draft: {
        kind: "care_entry",
        petId: "pet-1",
        date: "2026-10-10",
        time: null,
        note: null,
        details: { kind: "weight", weightKg: 31.5 },
        missing: [],
        ambiguities: [],
      },
      phrase: { saidAt: Date.parse("2026-10-11T00:00:00Z"), timeZone: "Asia/Vladivostok" },
    });

    expect(model.form.form.fields.occurredAt()).toBe("2026-10-10T03:00");
  });

  test("fills the form at the moment it was said when the phrase names no day", async () => {
    const { model } = startCare();

    await loaded(model);
    model.editDraft({
      draftId: "draft-6",
      draft: {
        kind: "care_entry",
        petId: "pet-1",
        date: null,
        time: null,
        note: null,
        details: { kind: "weight", weightKg: 31.5 },
        missing: [],
        ambiguities: [],
      },
      phrase: saidThisMorning,
    });

    expect(model.form.form.fields.occurredAt()).toBe("2026-10-11T09:00");
  });

  test("says it could not save while no Pet is open, and saves nothing", async () => {
    const { model, backend, openedPet } = startCare();

    await loaded(model);
    model.editDraft({
      draftId: "draft-4",
      draft: {
        kind: "care_entry",
        petId: null,
        date: null,
        time: null,
        note: null,
        details: { kind: "weight", weightKg: 31.5 },
        missing: ["pet"],
        ambiguities: [],
      },
      phrase: saidThisMorning,
    });
    openedPet.set(undefined);
    model.form.save();

    await vi.waitFor(() => {
      expect(model.form.failure()).toBe("Не получилось сохранить запись. Попробуйте ещё раз.");
    });
    expect(model.screen()).toEqual({ kind: "form", isCreating: true });
    expect(backend.requests.map(({ request }) => request)).not.toContain(
      "POST /api/pets/pet-1/care-entries",
    );
  });
});

describe("a Care Entry opened from outside the card", () => {
  test("opens its Pet and its form when nothing is open yet, as a Due Date reminder's link does", async () => {
    const { model, openedPet } = startCare();

    openedPet.set(undefined);
    model.openEntry("entry-7");

    await vi.waitFor(() => {
      expect(model.screen()).toEqual({ kind: "form", isCreating: false });
    });
    expect(openedPet()).toBe("pet-2");
    expect(model.form.form.fields.name()).toBe("Нобивак DHPPi");
    expect(model.form.form.fields.dueDate()).toBe("2026-10-02");
  });

  test("opens an entry of another Pet than the open one and saves it in place", async () => {
    const { model, backend, openedPet } = startCare();

    await loaded(model);
    model.openEntry("entry-7");
    await vi.waitFor(() => {
      expect(model.form.form.fields.name()).toBe("Нобивак DHPPi");
    });

    expect(openedPet()).toBe("pet-2");

    model.form.save();
    await vi.waitFor(() => {
      expect(model.canGoBack()).toBe(false);
    });
    expect(backend.requests.map(({ request }) => request)).toContain(
      "PUT /api/care-entries/entry-7",
    );
  });

  test("opens an archived Pet's entry to read, without taking photos", async () => {
    const { model, isArchived } = startCare();

    isArchived.set(true);
    model.openEntry("entry-7");

    await vi.waitFor(() => {
      expect(model.screen()).toEqual({ kind: "form", isCreating: false });
    });
    expect(model.isReadOnly()).toBe(true);
    expect(model.attachments.canAdd()).toBe(false);
  });

  test("leaves the card as it is when the entry is gone", async () => {
    const { model, backend, openedPet } = startCare();

    await loaded(model);
    model.openEntry("entry-gone");
    await vi.waitFor(() => {
      expect(backend.requests.map(({ request }) => request)).toContain(
        "GET /api/care-entries/entry-gone",
      );
    });

    expect(model.screen()).toEqual({ kind: "blocks" });
    expect(openedPet()).toBe("pet-1");
  });

  test("follows up a Due Date before the Pet's journal has loaded", async () => {
    const { model, openedPet } = startCare();

    openedPet.set("pet-2");
    model.followUp("entry-7");

    await vi.waitFor(() => {
      expect(model.screen()).toEqual({ kind: "form", isCreating: true });
    });
    expect(model.form.kind()).toBe("vaccination");
    expect(model.form.form.fields.name()).toBe("Нобивак DHPPi");
  });
});
