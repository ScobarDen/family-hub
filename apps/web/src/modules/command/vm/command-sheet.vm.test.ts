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
  type TaskDraft,
} from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client";
import { fakeBottomButton } from "@/common/telegram";

import { createCommandApi } from "../command.api.ts";
import {
  createFailedText,
  pickFailedText,
  reatomCommandSheet,
  staleDraftText,
  type OpenedDraft,
} from "./command-sheet.vm.ts";

const phrase = { saidAt: Date.parse("2026-10-11T06:00:00Z"), timeZone: "Europe/Moscow" };

const internet: TaskDraft = {
  kind: "task",
  title: "Оплатить интернет",
  note: null,
  date: "2026-10-16",
  time: "19:00",
  endDate: null,
  endTime: null,
  recurrence: { frequency: "monthly", until: null },
  visibility: "shared",
  reminderOffsets: ["at-start"],
  recipientIds: ["member-1", "member-2", "member-3"],
  petId: null,
  missing: [],
  ambiguities: [],
};

const members: FamilyMember[] = [
  { id: "member-1", name: "Денис", isFamilyOwner: true, profilePicture: null },
  { id: "member-2", name: "Ася", isFamilyOwner: false, profilePicture: null },
  { id: "member-3", name: "Ася", isFamilyOwner: false, profilePicture: null },
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
  let pickFailure: Response | undefined;
  const replies: Record<string, (body: unknown) => Response> = {
    "POST /api/commands/voice": () => Response.json(outcome),
    "GET /api/family/members": () => Response.json(members),
    "GET /api/pets": () => Response.json(pets),
    "GET /api/commands/draft-1": () => Response.json(outcome),
    "POST /api/commands/draft-1/create": () =>
      createFailure ??
      Response.json({ kind: "task", id: "task-1" } satisfies DraftCreated, {
        status: 201,
      }),
    "POST /api/commands/draft-1/dismiss": () => Response.json({ status: "dismissed" }),
    "POST /api/commands/draft-1/pick": (body) =>
      pickFailure ??
      Response.json({
        status: "draft",
        draftId: "draft-1",
        phrase,
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
    breakPick() {
      pickFailure = Response.json({}, { status: 500 });
    },
  };
}

function sheetOver(
  backend: ReturnType<typeof fakeBackend>,
  {
    onEdit = noop,
    onCreated = noop,
    telegram = { mainButton: fakeBottomButton(), secondaryButton: fakeBottomButton() },
  }: {
    onEdit?: (opened: OpenedDraft) => void;
    onCreated?: (created: DraftCreated) => void;
    telegram?: {
      mainButton: ReturnType<typeof fakeBottomButton>;
      secondaryButton: ReturnType<typeof fakeBottomButton>;
    };
  } = {},
) {
  return reatomCommandSheet({
    api: createCommandApi(createHttpClient({ baseUrl: "https://api.test", fetch: backend.fetch })),
    members: { data: () => members },
    pets: { data: () => pets },
    telegram,
    onEdit,
    onCreated,
  });
}

function startSheet(draft: TaskDraft = internet) {
  const backend = fakeBackend({ status: "draft", draftId: "draft-1", phrase, heard, draft });
  const edited: OpenedDraft[] = [];
  const created: DraftCreated[] = [];
  const telegram = { mainButton: fakeBottomButton(), secondaryButton: fakeBottomButton() };
  const model = sheetOver(backend, {
    onEdit: (opened) => {
      edited.push(opened);
    },
    onCreated: (record) => {
      created.push(record);
    },
    telegram,
  });

  model.start();

  return { model, backend, edited, created, ...telegram };
}

async function sent(model: ReturnType<typeof reatomCommandSheet>) {
  model.send(new Blob(["voice"], { type: "audio/mp4" }));

  await vi.waitFor(() => {
    const sheet = model.sheet();

    expect(sheet.kind === "draft" && sheet.preview.details.length === 4).toBe(true);
  });
}

beforeEach(() => {
  context.reset();
});

describe("the preview sheet", () => {
  test("shows what was heard and the draft the way the bot does", async () => {
    const { model } = startSheet();

    await sent(model);

    expect(model.sheet()).toMatchObject({
      kind: "draft",
      heard,
      preview: {
        title: "Оплатить интернет",
        details: ["пт 16 окт, 19:00", "каждый месяц", "в момент", "напомнить: Денис, Ася, Ася"],
        missing: undefined,
        question: undefined,
        hint: undefined,
        canCreate: true,
      },
      error: undefined,
    });
  });

  test("brings the draft back with the reason the server refused", async () => {
    const { model, backend, created, mainButton } = startSheet();

    await sent(model);
    backend.refuseCreate("RECIPIENTS_NOT_ALLOWED");
    model.create();

    expect(model.sheet()).toMatchObject({ kind: "draft", isCreating: true });

    await vi.waitFor(() => {
      expect(model.sheet()).toMatchObject({
        kind: "draft",
        isCreating: false,
        error:
          "Не получилось создать: кого-то из получателей уже нет в семье. Выберите получателей в «Изменить».",
      });
    });
    expect(created).toEqual([]);
    expect(mainButton.states.at(-1)).toEqual({ text: "Создать", isInProgress: false });
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

  test("shows Telegram's «Создать» and «Изменить» over a draft, with progress while creating", async () => {
    const { model, mainButton, secondaryButton } = startSheet();

    await sent(model);

    await vi.waitFor(() => {
      expect(mainButton.states.at(-1)).toEqual({ text: "Создать", isInProgress: false });
    });
    expect(secondaryButton.states.at(-1)).toEqual({ text: "Изменить", isInProgress: false });

    mainButton.click();

    await vi.waitFor(() => {
      expect(model.sheet().kind).toBe("created");
    });
    expect(mainButton.states).toContainEqual({ text: "Создать", isInProgress: true });
    expect(mainButton.states.at(-1)).toBeUndefined();
    expect(secondaryButton.states.at(-1)).toBeUndefined();
  });

  test("creates once however often «Создать» is pressed while it runs", async () => {
    const { model, backend, mainButton, secondaryButton, edited } = startSheet();

    await sent(model);
    mainButton.click();
    mainButton.click();
    model.create();
    secondaryButton.click();

    await vi.waitFor(() => {
      expect(model.sheet().kind).toBe("created");
    });
    expect(backend.requests.filter((request) => request.endsWith("/create"))).toHaveLength(1);
    expect(edited).toEqual([]);
  });

  test("hands «Изменить» from Telegram's button to the form", async () => {
    const { model, secondaryButton, edited } = startSheet();

    await sent(model);
    secondaryButton.click();

    expect(edited).toEqual([{ draftId: "draft-1", phrase, draft: internet }]);
    expect(model.sheet().kind).toBe("closed");
  });

  test("keeps the buttons in the sheet on a client without Telegram's bottom buttons", async () => {
    const backend = fakeBackend({
      status: "draft",
      draftId: "draft-1",
      phrase,
      heard,
      draft: internet,
    });
    const mainButton = fakeBottomButton({ isAvailable: false });
    const model = sheetOver(backend, {
      telegram: { mainButton, secondaryButton: fakeBottomButton({ isAvailable: false }) },
    });

    model.start();
    await sent(model);

    expect(model.hasNativeButtons).toBe(false);
    expect(mainButton.states).toEqual([]);
  });

  test("tells the app what was created", async () => {
    const { model, created } = startSheet();

    await sent(model);
    model.create();

    await vi.waitFor(() => {
      expect(created).toEqual([{ kind: "task", id: "task-1" }]);
    });
    expect(model.sheet().kind).toBe("created");
  });

  test("offers no «Создать» to an incomplete draft and asks which Member was meant", async () => {
    const { model } = startSheet({
      ...internet,
      title: null,
      recipientIds: [],
      missing: ["title"],
      ambiguities: [
        { field: "recipients", mention: "Ася", candidateIds: ["member-2", "member-3"] },
      ],
    });

    model.send(new Blob(["voice"]));

    await vi.waitFor(() => {
      expect(model.sheet()).toMatchObject({
        kind: "draft",
        preview: {
          missing: "Не хватает: что за дело",
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
        preview: {
          question: undefined,
          details: ["пт 16 окт, 19:00", "каждый месяц", "в момент", "напомнить: Ася"],
        },
      });
    });
  });

  test("keeps the draft with a word when a pick fails", async () => {
    const { model, backend } = startSheet();

    await sent(model);
    backend.breakPick();
    model.pick(0);

    await vi.waitFor(() => {
      expect(model.sheet()).toMatchObject({ kind: "draft", error: pickFailedText });
    });
  });

  test("hands the draft to its form on «Изменить» and drops it on «×»", async () => {
    const { model, backend, edited } = startSheet();

    await sent(model);
    model.edit();

    expect(edited).toEqual([{ draftId: "draft-1", phrase, draft: internet }]);
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
      expect(edited).toEqual([{ draftId: "draft-1", phrase, draft: internet }]);
    });
    expect(model.sheet().kind).toBe("closed");

    model.openForEdit("draft-gone");

    await vi.waitFor(() => {
      expect(model.sheet()).toEqual({ kind: "failure", heard: null, message: staleDraftText });
    });
  });

  test("shows a timed Task draft with its repeat and Reminders", async () => {
    const backend = fakeBackend({
      status: "draft",
      draftId: "draft-1",
      phrase,
      heard: null,
      draft: {
        kind: "task",
        title: "Груминг Бьюика",
        note: null,
        date: "2026-10-17",
        time: "12:00",
        endDate: null,
        endTime: "14:00",
        recurrence: { frequency: "monthly", until: null },
        visibility: "private",
        reminderOffsets: ["1h", "1d"],
        recipientIds: ["member-1"],
        petId: null,
        missing: [],
        ambiguities: [],
      },
    });
    const model = sheetOver(backend);

    model.send(new Blob(["voice"]));

    await vi.waitFor(() => {
      expect(model.sheet()).toMatchObject({
        kind: "draft",
        preview: {
          title: "Груминг Бьюика",
          details: [
            "сб 17 окт, 12:00",
            "каждый месяц",
            "за час, за день",
            "напомнить мне",
            "только мне",
          ],
          canCreate: true,
        },
      });
    });
  });

  test("shows a Care Entry with its cost and repeat date, and asks which Pet in care", async () => {
    const backend = fakeBackend({
      status: "draft",
      draftId: "draft-1",
      phrase,
      heard: null,
      draft: {
        kind: "care_entry",
        petId: null,
        date: null,
        time: null,
        repeatOn: "2027-10-13",
        note: null,
        details: {
          kind: "vaccination",
          vaccine: "Бешенство",
          cost: { amount: 1800, category: "vet" },
        },
        missing: [],
        ambiguities: [{ field: "pet", mention: "", candidateIds: ["pet-1", "pet-2"] }],
      },
    });
    const model = sheetOver(backend);

    model.send(new Blob(["voice"]));

    await vi.waitFor(() => {
      expect(model.sheet()).toMatchObject({
        kind: "draft",
        preview: {
          title: "Прививка «Бешенство»",
          details: ["сейчас", expect.stringMatching(/^1\s800\s₽$/u), "повторить ср 13 окт"],
          question: {
            title: "Для какого питомца?",
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
    const model = sheetOver(backend);

    model.send(new Blob(["voice"]));

    await vi.waitFor(() => {
      expect(model.sheet()).toEqual({ kind: "failure", heard: null, message: "Не расслышал" });
    });
  });
});
