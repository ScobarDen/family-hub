import { context, noop, sleep } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { recipeChange, type Recipe } from "@family-hub/contract";

import { reatomDeviceCache } from "@/common/device-cache";
import { createHttpClient } from "@/common/http-client";
import { fakeSlide } from "@/common/state";
import {
  fakeDeviceStorage,
  type FakeDeviceStorage,
  fakeHaptics,
  fakeWindow,
} from "@/common/telegram";

import { createRecipesApi } from "../recipes.api.ts";
import { reatomRecipesScreen } from "./recipes.vm.ts";

const lasagna: Recipe = {
  id: "recipe-1",
  title: "Лазанья",
  ingredients: ["Листы лазаньи", "Фарш", "Сыр"],
  method: "Собрать слоями и запечь.",
  photos: [],
  tags: [{ id: "tag-1", name: "Паста" }],
  isFavorite: false,
  canDelete: true,
  createdAt: 0,
};

const borscht: Recipe = { ...lasagna, id: "recipe-2", title: "Борщ", tags: [] };

function replyOf(url: URL, method: string, body: unknown): unknown {
  if (url.pathname.endsWith("/share")) {
    return { preparedMessageId: "prepared-1" };
  }

  if (url.pathname === "/api/recipe-tags") {
    return lasagna.tags;
  }

  if (url.pathname === "/api/recipes/recipe-1" && method === "DELETE") {
    return { status: "deleted" };
  }

  if (url.pathname !== "/api/recipes") {
    return lasagna;
  }

  if (method === "POST") {
    return { ...lasagna, ...recipeChange.parse(body), id: "recipe-3", ingredients: ["Фарш"] };
  }

  return url.searchParams.has("q") ? [lasagna] : [borscht, lasagna];
}

type Launch = {
  failing?: string;
  unreachable?: string;
  held?: string;
  popup?: string;
  device?: FakeDeviceStorage;
  book?: Recipe[];
  answered?: Promise<void>;
  canShareMessage?: boolean;
};

async function troubleOf(
  request: string,
  { failing, unreachable, held }: Pick<Launch, "failing" | "unreachable" | "held">,
): Promise<Response | undefined> {
  if (request === failing) {
    return Response.json({}, { status: 500 });
  }

  if (request === unreachable) {
    throw new TypeError("Failed to fetch");
  }

  if (request === held) {
    await new Promise(noop);
  }

  return undefined;
}

function startRecipes({
  failing,
  unreachable,
  held,
  popup = "confirm",
  device = fakeDeviceStorage(),
  book = [borscht, lasagna],
  answered = Promise.resolve(),
  canShareMessage = true,
}: Launch = {}) {
  const requests: Array<{ request: string; body: unknown }> = [];
  const alerts: string[] = [];
  const shared: string[] = [];
  const { slides, slide } = fakeSlide();

  async function fetch(url: URL, init: RequestInit): Promise<Response> {
    const request = `${init.method ?? "GET"} ${url.pathname}${url.search}`;
    const body: unknown = typeof init.body === "string" ? JSON.parse(init.body) : undefined;

    requests.push({ request, body });

    const trouble = await troubleOf(request, { failing, unreachable, held });

    if (trouble !== undefined) {
      return trouble;
    }

    if (request === "GET /api/recipes/recipe-1") {
      return Response.json(lasagna);
    }

    if (request === "GET /api/recipes") {
      await answered;

      return Response.json(book);
    }

    return Response.json(replyOf(url, init.method ?? "GET", body));
  }

  const haptics = fakeHaptics();
  const model = reatomRecipesScreen({
    api: createRecipesApi(createHttpClient({ baseUrl: "https://api.family-hub.test", fetch })),
    telegram: {
      ...fakeWindow(),
      showPopup: async () => popup,
      showAlert(message: string) {
        alerts.push(message);
      },
      haptics,
      canShareMessage,
      async shareMessage(preparedMessageId: string) {
        shared.push(preparedMessageId);

        return true;
      },
    },
    preparePhoto: async (file) => ({ file, takenAt: null }),
    photoHint: () => "Загрузка фото выключена",
    deviceCache: reatomDeviceCache(device.deviceStorage),
    slide,
  });

  model.screen.subscribe(noop);

  return { model, requests, alerts, shared, slides, felt: haptics.felt };
}

type Model = ReturnType<typeof startRecipes>["model"];

async function listed(model: Model) {
  await vi.waitFor(() => {
    expect(model.screen().kind).toBe("list");
  });
}

function titles(model: Model) {
  const screen = model.screen();

  return screen.kind === "list" ? screen.recipes.map(({ title }) => title) : [];
}

beforeEach(() => {
  context.reset();
});

describe("the Recipes", () => {
  test("are listed with the Family's tags and searched on the server", async () => {
    const { model, requests } = startRecipes();

    await listed(model);

    expect(titles(model)).toEqual(["Борщ", "Лазанья"]);
    expect(model.screen()).toMatchObject({ summary: "2 рецепта", empty: undefined });

    model.search("сыр");
    model.chooseTag("tag-1");
    model.toggleFavorites();
    await vi.waitFor(() => {
      expect(titles(model)).toEqual(["Лазанья"]);
    });

    expect(requests.map(({ request }) => request)).toContain(
      "GET /api/recipes?q=%D1%81%D1%8B%D1%80&tag=tag-1&favorite=true",
    );
  });

  test("tick off ingredients on the screen alone", async () => {
    const { model, requests } = startRecipes();

    await listed(model);
    model.open("recipe-1");
    await vi.waitFor(() => {
      expect(model.screen().kind).toBe("recipe");
    });
    model.toggleIngredient(1);
    model.toggleIngredient(2);
    model.toggleIngredient(1);

    expect(model.screen()).toMatchObject({ kind: "recipe", checked: [2] });
    expect(requests.some(({ request }) => request.startsWith("PUT"))).toBe(false);

    model.back();
    model.open("recipe-1");

    expect(model.screen()).toMatchObject({ checked: [] });
  });

  test("are written with their tags and opened once saved", async () => {
    const { model, requests } = startRecipes();

    await listed(model);
    model.add();
    model.form.form.fields.title.set("Котлеты");
    model.form.form.fields.ingredients.set("Фарш");
    model.form.toggleTag("tag-1");
    model.form.save();
    await vi.waitFor(() => {
      expect(model.screen().kind).toBe("recipe");
    });

    expect(requests.find(({ request }) => request === "POST /api/recipes")?.body).toEqual({
      title: "Котлеты",
      ingredients: "Фарш",
      method: null,
      tagIds: ["tag-1"],
      photoIds: [],
    });
  });
});

describe("opening a Recipe", () => {
  test("slides it in", async () => {
    const { model, slides } = startRecipes();

    await openLasagna(model);

    expect(slides).toEqual(["forward"]);
  });
  test("keeps it under its form, and Back closes only the form", async () => {
    const { model } = startRecipes();

    await openLasagna(model);
    model.edit();

    expect([model.screen().kind, model.isFormOpen(), model.formTitle()]).toEqual([
      "recipe",
      true,
      "Рецепт",
    ]);

    model.back();

    expect([model.screen().kind, model.isFormOpen()]).toEqual(["recipe", false]);
  });
});

describe("sharing a Recipe", () => {
  test("sends the card the bot prepared through Telegram's share sheet", async () => {
    const { model, shared } = startRecipes();

    await openLasagna(model);
    model.share();
    await vi.waitFor(() => {
      expect(shared).toEqual(["prepared-1"]);
    });

    expect(model.canShare).toBe(true);
  });

  test("is not offered where Telegram cannot share a prepared message", () => {
    const { model } = startRecipes({ canShareMessage: false });

    expect(model.canShare).toBe(false);
  });

  test("says so when the card could not be prepared", async () => {
    const { model, alerts, shared } = startRecipes({
      failing: "POST /api/recipes/recipe-1/share",
    });

    await openLasagna(model);
    model.share();
    await vi.waitFor(() => {
      expect(alerts).toEqual(["Не получилось поделиться рецептом. Попробуйте ещё раз."]);
    });

    expect(shared).toEqual([]);
  });
});

describe("the Family's tags", () => {
  test("keep a new tag's text when the server refuses it", async () => {
    const { model } = startRecipes({ failing: "POST /api/recipe-tags" });

    await listed(model);
    model.typeNewTag("Супы");
    model.addTag();
    await vi.waitFor(() => {
      expect(model.tagFailure()).toBe("Не получилось сохранить тег. Попробуйте ещё раз.");
    });

    expect(model.newTag()).toBe("Супы");
  });

  test("show the saved name again when a rename fails", async () => {
    const { model } = startRecipes({ failing: "PUT /api/recipe-tags/tag-1" });
    const [pasta] = lasagna.tags;

    await listed(model);
    model.typeTagName("tag-1", "Макароны");

    expect(pasta && model.tagNameOf(pasta)).toBe("Макароны");

    model.renameTag("tag-1");
    await vi.waitFor(() => {
      expect(model.tagFailure()).toBeDefined();
    });

    expect(pasta && model.tagNameOf(pasta)).toBe("Паста");
  });
});

async function openLasagna(model: Model) {
  await listed(model);
  model.open("recipe-1");
  await vi.waitFor(() => {
    expect(model.screen().kind).toBe("recipe");
  });
}

function tagNames(model: Model) {
  const screen = model.screen();

  return screen.kind === "list" ? screen.tags.map(({ name }) => name) : [];
}

const writes = [
  {
    name: "deleting a Recipe",
    request: "DELETE /api/recipes/recipe-1",
    act: async (model: Model) => {
      await openLasagna(model);
      model.remove();
    },
    observe: titles,
    before: ["Борщ", "Лазанья"],
    after: ["Борщ"],
    felt: ["warning"],
  },
  {
    name: "deleting a tag",
    request: "DELETE /api/recipe-tags/tag-1",
    act: async (model: Model) => {
      await vi.waitFor(() => {
        expect(tagNames(model)).toEqual(["Паста"]);
      });
      model.removeTag("tag-1");
    },
    observe: tagNames,
    before: ["Паста"],
    after: [],
    felt: ["warning"],
  },
];

describe.each(writes)("$name", ({ request, act, observe, before, after, felt: tap }) => {
  test("shows before the server answers, with one pulse", async () => {
    const { model, felt } = startRecipes({ held: request });

    await act(model);
    await vi.waitFor(() => {
      expect(observe(model)).toEqual(after);
    });

    expect(model.failure()).toBeUndefined();
    expect(felt).toEqual(tap);
  });

  test.each([
    {
      option: "failing",
      said: expect.stringMatching(/^Не получилось .+ Попробуйте ещё раз\.$/u) as unknown,
    },
    { option: "unreachable", said: "Нет связи — не сохранилось. Проверьте интернет и повторите." },
  ])(
    "rolls back with the failure bar and an error pulse when $option",
    async ({ option, said }) => {
      const { model, felt } = startRecipes({ [option]: request });

      await act(model);
      await vi.waitFor(() => {
        expect(model.failure()).toEqual(said);
      });

      expect(observe(model)).toEqual(before);
      expect(felt).toEqual([...tap, "error"]);
    },
  );
});

function relaunch(device: FakeDeviceStorage) {
  context.reset();
  let answer = noop;
  const { model } = startRecipes({
    device,
    book: [borscht],
    answered: new Promise((resolve) => {
      answer = resolve;
    }),
  });

  return { model, answer };
}

describe("launching from the device cache", () => {
  test("shows the Recipe cards of the last launch until the fresh ones arrive", async () => {
    const device = fakeDeviceStorage();

    await listed(startRecipes({ device }).model);
    await vi.waitFor(() => {
      expect(device.items.has("recipes")).toBe(true);
    });
    const { model, answer } = relaunch(device);

    await vi.waitFor(() => {
      expect(titles(model)).toEqual(["Борщ", "Лазанья"]);
    });
    answer();
    await vi.waitFor(() => {
      expect(titles(model)).toEqual(["Борщ"]);
    });
  });

  test("keeps the cards without their cooking steps", async () => {
    const device = fakeDeviceStorage();

    await listed(startRecipes({ device }).model);
    await vi.waitFor(() => {
      expect(device.items.get("recipes")).toContain("Лазанья");
    });

    expect(device.items.get("recipes")).not.toContain(lasagna.method);
  });

  test("keeps the whole book rather than a search", async () => {
    const device = fakeDeviceStorage();
    const { model } = startRecipes({ device });

    await listed(model);
    model.search("лаз");
    await vi.waitFor(() => {
      expect(titles(model)).toEqual(["Лазанья"]);
    });
    await sleep(0);
    const relaunched = relaunch(device);

    await vi.waitFor(() => {
      expect(titles(relaunched.model)).toEqual(["Борщ", "Лазанья"]);
    });
  });
});
