import { context, noop, sleep } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { recipeChange, type Recipe } from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client";

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
  cookedCount: 0,
  lastCookedAt: null,
  cooks: [],
};

const borscht: Recipe = { ...lasagna, id: "recipe-2", title: "Борщ", tags: [] };

function replyOf(url: URL, method: string, body: unknown): unknown {
  if (url.pathname === "/api/recipe-tags") {
    return lasagna.tags;
  }

  if (url.pathname !== "/api/recipes") {
    return lasagna;
  }

  if (method === "POST") {
    return { ...lasagna, ...recipeChange.parse(body), id: "recipe-3", ingredients: ["Фарш"] };
  }

  return url.searchParams.has("q") ? [lasagna] : [borscht, lasagna];
}

function startRecipes({
  failing = "",
  popup = "confirm",
}: { failing?: string; popup?: string } = {}) {
  const requests: Array<{ request: string; body: unknown }> = [];
  const alerts: string[] = [];

  async function fetch(url: URL, init: RequestInit): Promise<Response> {
    const request = `${init.method ?? "GET"} ${url.pathname}${url.search}`;
    const body: unknown = typeof init.body === "string" ? JSON.parse(init.body) : undefined;

    requests.push({ request, body });

    if (request === failing) {
      return Response.json({}, { status: 500 });
    }

    return Response.json(replyOf(url, init.method ?? "GET", body));
  }

  const model = reatomRecipesScreen({
    api: createRecipesApi(createHttpClient({ baseUrl: "https://api.family-hub.test", fetch })),
    telegram: {
      showPopup: async () => popup,
      showAlert(message: string) {
        alerts.push(message);
      },
    },
    preparePhoto: async (file) => ({ file, takenAt: null }),
    photoHint: () => "Загрузка фото выключена",
    today: () => "2026-10-21",
    timeZone: () => "Europe/Moscow",
  });

  model.screen.subscribe(noop);

  return { model, requests, alerts };
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

  test("stay open with a word when one cannot be deleted", async () => {
    const { model, alerts } = startRecipes({ failing: "DELETE /api/recipes/recipe-1" });

    await listed(model);
    model.open("recipe-1");
    await vi.waitFor(() => {
      expect(model.screen().kind).toBe("recipe");
    });
    model.remove();
    await vi.waitFor(() => {
      expect(alerts).toEqual(["Не получилось удалить рецепт. Попробуйте ещё раз."]);
    });

    expect(model.screen().kind).toBe("recipe");
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

describe("cooking a Recipe", () => {
  test("lists what was cooked longest ago once asked", async () => {
    const { model, requests } = startRecipes();

    await listed(model);
    model.toggleForgotten();
    await vi.waitFor(() => {
      expect(requests.map(({ request }) => request)).toContain("GET /api/recipes?sort=forgotten");
    });

    expect(model.ordering()).toBe("forgotten");
  });

  test("marks today as now and an earlier day at its midday", async () => {
    const { model, requests } = startRecipes();

    await listed(model);
    model.open("recipe-1");
    await vi.waitFor(() => {
      expect(model.screen().kind).toBe("recipe");
    });
    model.chooseCookDay("2026-10-21");
    model.cook();
    await vi.waitFor(() => {
      expect(model.isCooking()).toBe(false);
    });
    model.chooseCookDay("2026-10-18");
    model.cook();
    await vi.waitFor(() => {
      expect(requests.filter(({ request }) => request.endsWith("/cooked"))).toHaveLength(2);
    });

    expect(
      requests.filter(({ request }) => request.endsWith("/cooked")).map(({ body }) => body),
    ).toEqual([{ cookedAt: null }, { cookedAt: Date.parse("2026-10-18T09:00:00Z") }]);
  });

  test.each([
    { popup: "confirm", isDeleted: true },
    { popup: "cancel", isDeleted: false },
  ])(
    "takes a «Приготовили» mark away only once confirmed: $popup",
    async ({ popup, isDeleted }) => {
      const { model, requests } = startRecipes({ popup });

      await listed(model);
      model.open("recipe-1");
      await vi.waitFor(() => {
        expect(model.screen().kind).toBe("recipe");
      });
      model.uncook("cook-1");
      await sleep(0);
      await vi.waitFor(() => {
        expect(model.isCooking()).toBe(false);
      });

      expect(requests.some(({ request }) => request.startsWith("DELETE"))).toBe(isDeleted);
    },
  );
});
