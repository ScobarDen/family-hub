import { context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import {
  draftPick,
  type ApiError,
  type CommandOutcome,
  type DraftCreated,
  type DraftRefusal,
  type FamilyMember,
  type Pet,
  type ReminderDraft,
} from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client";

import { createCommandApi } from "../command.api.ts";
import {
  createFailedText,
  reatomCommandSheet,
  staleDraftText,
  type OpenedDraft,
} from "./command-sheet.vm.ts";

const internet: ReminderDraft = {
  kind: "reminder",
  text: "Оплатить интернет",
  date: "2026-10-16",
  time: "19:00",
  recurrence: { frequency: "monthly", until: null },
  visibility: "shared",
  recipientIds: null,
  missing: [],
  ambiguities: [],
};

const members: FamilyMember[] = [
  { id: "member-1", name: "Денис", isFamilyOwner: true },
  { id: "member-2", name: "Ася", isFamilyOwner: false },
  { id: "member-3", name: "Ася", isFamilyOwner: false },
];

const heard = "напомни в пятницу в 19:00 оплатить интернет";

const pets = [
  buickPet("pet-1", "Бьюик"),
  buickPet("pet-2", "Мурка"),
  { ...buickPet("pet-3", "Рекс"), archivedAt: 1 },
];

function buickPet(id: string, name: string): Pet {
  return {
    id,
    name,
    species: "dog",
    breed: null,
    sex: null,
    birthDate: null,
    chipNumber: null,
    notes: null,
    archivedAt: null,
    memo: { food: null, clinic: null, important: null, updatedAt: null, updatedBy: null },
    avatar: null,
  };
}

function fakeBackend(outcome: CommandOutcome) {
  const requests: string[] = [];
  let createFailure: Response | undefined;
  const replies: Record<string, (body: unknown) => Response> = {
    "POST /api/commands/voice": () => Response.json(outcome),
    "GET /api/family/members": () => Response.json(members),
    "GET /api/pets": () => Response.json(pets),
    "GET /api/commands/draft-1": () => Response.json(outcome),
    "POST /api/commands/draft-1/create": () =>
      createFailure ??
      Response.json({ kind: "reminder", id: "reminder-1" } satisfies DraftCreated, {
        status: 201,
      }),
    "POST /api/commands/draft-1/dismiss": () => Response.json({ status: "dismissed" }),
    "POST /api/commands/draft-1/pick": (body) =>
      Response.json({
        status: "draft",
        draftId: "draft-1",
        heard: null,
        draft: {
          ...internet,
          recipientIds: [members[draftPick.parse(body).index + 1]?.id ?? ""],
        },
      } satisfies CommandOutcome),
  };

  async function fetch(url: URL, init: RequestInit): Promise<Response> {
    const request = `${init.method ?? "GET"} ${url.pathname}`;

    requests.push(request);

    return (
      replies[request]?.(typeof init.body === "string" ? JSON.parse(init.body) : undefined) ??
      Response.json({}, { status: 404 })
    );
  }

  return {
    fetch,
    requests,
    refuseCreate(code: DraftRefusal) {
      createFailure = Response.json({ code, message: "" } satisfies ApiError, { status: 409 });
    },
    breakCreate() {
      createFailure = Response.json({}, { status: 500 });
    },
  };
}

function startSheet(draft: ReminderDraft = internet) {
  const backend = fakeBackend({ status: "draft", draftId: "draft-1", heard, draft });
  const edited: OpenedDraft[] = [];
  const created: DraftCreated[] = [];
  const api = createCommandApi(
    createHttpClient({ baseUrl: "https://api.test", fetch: backend.fetch }),
  );
  const model = reatomCommandSheet({
    api,
    onEdit: (opened) => {
      edited.push(opened);
    },
    onCreated: (record) => {
      created.push(record);
    },
  });

  return { model, backend, edited, created };
}

async function sent(model: ReturnType<typeof reatomCommandSheet>) {
  model.send(new Blob(["voice"], { type: "audio/mp4" }));

  await vi.waitFor(() => {
    const sheet = model.sheet();

    expect(sheet.kind === "draft" && sheet.preview.details.length === 3).toBe(true);
  });
}

beforeEach(() => {
  context.reset();
});

describe("the preview sheet", () => {
  test("shows what was heard and the draft the way the bot does", async () => {
    const { model } = startSheet();

    await sent(model);

    expect(model.sheet()).toEqual({
      kind: "draft",
      heard,
      preview: {
        title: "Оплатить интернет",
        details: ["пт 16 окт, 19:00", "каждый месяц", "Денис, Ася, Ася"],
        missing: undefined,
        question: undefined,
        hint: undefined,
        canCreate: true,
      },
      error: undefined,
    });
  });

  test("shows «Создано» at once and brings the draft back with the reason the server refused", async () => {
    const { model, backend, created } = startSheet();

    await sent(model);
    backend.refuseCreate("RECIPIENTS_NOT_ALLOWED");
    model.create();

    expect(model.sheet().kind).toBe("created");

    await vi.waitFor(() => {
      expect(model.sheet()).toMatchObject({
        kind: "draft",
        error:
          "Не получилось создать: кого-то из получателей уже нет в семье. Выберите получателей в «Изменить».",
      });
    });
    expect(created).toEqual([]);
  });

  test("brings the draft back with a general word when «Создать» fails for no stated reason", async () => {
    const { model, backend } = startSheet();

    await sent(model);
    backend.breakCreate();
    model.create();

    await vi.waitFor(() => {
      expect(model.sheet()).toMatchObject({ kind: "draft", error: createFailedText });
    });
  });

  test("tells the app what was created", async () => {
    const { model, created } = startSheet();

    await sent(model);
    model.create();

    await vi.waitFor(() => {
      expect(created).toEqual([{ kind: "reminder", id: "reminder-1" }]);
    });
    expect(model.sheet().kind).toBe("created");
  });

  test("offers no «Создать» to an incomplete draft and asks which Member was meant", async () => {
    const { model } = startSheet({
      ...internet,
      time: null,
      missing: ["time"],
      ambiguities: [
        { field: "recipients", mention: "Ася", candidateIds: ["member-2", "member-3"] },
      ],
    });

    model.send(new Blob(["voice"]));

    await vi.waitFor(() => {
      expect(model.sheet()).toMatchObject({
        kind: "draft",
        preview: {
          missing: "Не хватает: время",
          question: {
            title: "Кого вы имели в виду под «Ася»?",
            candidates: [
              { index: 0, name: "Ася" },
              { index: 1, name: "Ася" },
            ],
          },
          canCreate: false,
        },
      });
    });

    model.pick(1);

    await vi.waitFor(() => {
      expect(model.sheet()).toMatchObject({
        kind: "draft",
        heard,
        preview: { question: undefined, details: ["пт 16 окт, 19:00", "каждый месяц", "Ася"] },
      });
    });
  });

  test("hands the draft to its form on «Изменить» and drops it on «×»", async () => {
    const { model, backend, edited } = startSheet();

    await sent(model);
    model.edit();

    expect(edited).toEqual([{ draftId: "draft-1", draft: internet }]);
    expect(model.sheet().kind).toBe("closed");

    await sent(model);
    model.close();

    await vi.waitFor(() => {
      expect(backend.requests).toContain("POST /api/commands/draft-1/dismiss");
    });
    expect(backend.requests.filter((request) => request.endsWith("/dismiss"))).toHaveLength(1);
  });

  test("opens the form of a draft the bot's «Изменить» links to, or says it is stale", async () => {
    const { model, edited } = startSheet();

    model.openForEdit("draft-1");

    await vi.waitFor(() => {
      expect(edited).toEqual([{ draftId: "draft-1", draft: internet }]);
    });
    expect(model.sheet().kind).toBe("closed");

    model.openForEdit("draft-gone");

    await vi.waitFor(() => {
      expect(model.sheet()).toEqual({ kind: "failure", heard: null, message: staleDraftText });
    });
  });

  test("shows an Event draft with its time, repeat and Reminders", async () => {
    const backend = fakeBackend({
      status: "draft",
      draftId: "draft-1",
      heard: null,
      draft: {
        kind: "event",
        title: "Груминг Бьюика",
        note: null,
        date: "2026-10-17",
        time: "12:00",
        endDate: null,
        endTime: "14:00",
        recurrence: { frequency: "monthly", until: null },
        visibility: "private",
        reminderOffsets: ["1h", "1d"],
        missing: [],
        ambiguities: [],
      },
    });
    const model = reatomCommandSheet({
      api: createCommandApi(
        createHttpClient({ baseUrl: "https://api.test", fetch: backend.fetch }),
      ),
      onEdit: noop,
      onCreated: noop,
    });

    model.send(new Blob(["voice"]));

    await vi.waitFor(() => {
      expect(model.sheet()).toMatchObject({
        kind: "draft",
        preview: {
          title: "Груминг Бьюика",
          details: ["сб 17 окт, 12:00", "каждый месяц", "напомнить за час, за день", "только мне"],
          canCreate: true,
        },
      });
    });
  });

  test("shows a Care Entry with its Pet, cost and Due Date, and asks which Pet in care", async () => {
    const backend = fakeBackend({
      status: "draft",
      draftId: "draft-1",
      heard: null,
      draft: {
        kind: "care_entry",
        petId: null,
        date: null,
        time: null,
        note: null,
        details: {
          kind: "vaccination",
          vaccine: "Бешенство",
          cost: { amount: 1800, category: "vet" },
          dueDate: "2027-10-13",
        },
        missing: [],
        ambiguities: [{ field: "pet", mention: "", candidateIds: ["pet-1", "pet-2"] }],
      },
    });
    const model = reatomCommandSheet({
      api: createCommandApi(
        createHttpClient({ baseUrl: "https://api.test", fetch: backend.fetch }),
      ),
      onEdit: noop,
      onCreated: noop,
    });

    model.send(new Blob(["voice"]));

    await vi.waitFor(() => {
      expect(model.sheet()).toMatchObject({
        kind: "draft",
        preview: {
          title: "Прививка «Бешенство»",
          details: ["сейчас", expect.stringMatching(/^1\s800\s₽$/u), "следующий срок ср 13 окт"],
          question: {
            title: "Для какого питомца запись?",
            candidates: [
              { index: 0, name: "Бьюик" },
              { index: 1, name: "Мурка" },
            ],
          },
          hint: "Фото можно приложить в «Изменить».",
          canCreate: false,
        },
      });
    });
  });

  test("says what went wrong with the bot's words", async () => {
    const backend = fakeBackend({ status: "unheard", heard: null, message: "Не расслышал" });
    const model = reatomCommandSheet({
      api: createCommandApi(
        createHttpClient({ baseUrl: "https://api.test", fetch: backend.fetch }),
      ),
      onEdit: noop,
      onCreated: noop,
    });

    model.send(new Blob(["voice"]));

    await vi.waitFor(() => {
      expect(model.sheet()).toEqual({ kind: "failure", heard: null, message: "Не расслышал" });
    });
  });
});
