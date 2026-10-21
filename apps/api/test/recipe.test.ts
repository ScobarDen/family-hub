import { describe, expect, test } from "vite-plus/test";

import type { Photo, Recipe, RecipeTag } from "@family-hub/contract";

import { signInitData, type TelegramUserFixture } from "./init-data.ts";
import { startWorker } from "./worker-harness.ts";

const denis = { id: 111, first_name: "Денис" };
const asya = { id: 222, first_name: "Ася" };

async function tokenOf(worker: ReturnType<typeof startWorker>, user: TelegramUserFixture) {
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

  return token;
}

async function request(
  worker: ReturnType<typeof startWorker>,
  user: TelegramUserFixture,
  { method = "GET", path, body }: { method?: string; path: string; body?: unknown },
) {
  return worker.request(path, {
    method,
    headers: {
      authorization: `Bearer ${await tokenOf(worker, user)}`,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function startWithFamily() {
  const worker = startWorker({ now: "2026-10-04T09:00:00Z" });
  const { familyId } = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });

  await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });
  await worker.setPhotoChannel(familyId, -100_500);

  return worker;
}

type Worker = Awaited<ReturnType<typeof startWithFamily>>;

async function uploaded(
  worker: Worker,
  { size, takenAt }: { size: number; takenAt: string | null },
): Promise<Photo> {
  const form = new FormData();

  form.append("file", new Blob([new Uint8Array(size)]), "photo.jpg");

  if (takenAt !== null) {
    form.append("takenAt", String(Date.parse(takenAt)));
  }

  const response = await worker.request("/api/photos", {
    method: "POST",
    headers: { authorization: `Bearer ${await tokenOf(worker, asya)}` },
    body: form,
  });

  return response.json<Photo>();
}

async function addRecipe(
  worker: Worker,
  user: TelegramUserFixture,
  change: Record<string, unknown>,
) {
  const response = await request(worker, user, {
    method: "POST",
    path: "/api/recipes",
    body: { title: "Лазанья", ingredients: "", method: null, ...change },
  });

  return response.json<Recipe>();
}

async function addTag(worker: Worker, name: string) {
  const response = await request(worker, asya, {
    method: "POST",
    path: "/api/recipe-tags",
    body: { name },
  });

  return response.json<RecipeTag>();
}

async function titlesOf(worker: Worker, user: TelegramUserFixture, query = "") {
  const response = await request(worker, user, { path: `/api/recipes${query}` });
  const recipes = await response.json<Recipe[]>();

  return recipes.map(({ title }) => title);
}

describe("a Recipe", () => {
  test("keeps its ingredients line by line, its method, tags and photos", async () => {
    const worker = await startWithFamily();
    const pasta = await addTag(worker, "Паста");
    const photo = await uploaded(worker, { size: 1, takenAt: null });
    const recipe = await addRecipe(worker, denis, {
      ingredients: "Листы лазаньи\n\n  Фарш 500 г \nСыр",
      method: "Собрать слоями и запечь.",
      tagIds: [pasta.id],
      photoIds: [photo.id],
    });

    expect(recipe).toMatchObject({
      ingredients: ["Листы лазаньи", "Фарш 500 г", "Сыр"],
      method: "Собрать слоями и запечь.",
      tags: [{ name: "Паста" }],
      photos: [{ id: photo.id }],
      canDelete: true,
    });
  });

  test("is edited by anyone and deleted only by its author", async () => {
    const worker = await startWithFamily();
    const recipe = await addRecipe(worker, denis, {});
    const edited = await request(worker, asya, {
      method: "PUT",
      path: `/api/recipes/${recipe.id}`,
      body: { title: "Лазанья по-бабушкиному", ingredients: "Фарш", method: null },
    });
    const byAsya = await request(worker, asya, {
      method: "DELETE",
      path: `/api/recipes/${recipe.id}`,
    });
    const byDenis = await request(worker, denis, {
      method: "DELETE",
      path: `/api/recipes/${recipe.id}`,
    });

    expect(edited.status).toBe(200);
    expect([byAsya.status, byDenis.status]).toEqual([403, 200]);
  });

  test("is found by any words of its title, ingredients or method", async () => {
    const worker = await startWithFamily();

    await addRecipe(worker, denis, { title: "Лазанья", ingredients: "Фарш\nСыр" });
    await addRecipe(worker, denis, {
      title: "Борщ",
      ingredients: "Свёкла\nКапуста",
      method: "Варить два часа",
    });
    await addRecipe(worker, denis, { title: "Сырники", ingredients: "Творог" });

    expect(await titlesOf(worker, asya, "?q=сыр")).toEqual(["Лазанья", "Сырники"]);
    expect(await titlesOf(worker, asya, `?q=${encodeURIComponent("свекла часа")}`)).toEqual([
      "Борщ",
    ]);
  });
});

describe("Recipe Tags", () => {
  test("filter the list, are renamed and leave the Recipes when deleted", async () => {
    const worker = await startWithFamily();
    const soup = await addTag(worker, "Супы");

    await addRecipe(worker, denis, { title: "Борщ", tagIds: [soup.id] });
    await addRecipe(worker, denis, { title: "Лазанья" });
    await request(worker, asya, {
      method: "PUT",
      path: `/api/recipe-tags/${soup.id}`,
      body: { name: "Первое" },
    });

    const tagged = await titlesOf(worker, denis, `?tag=${soup.id}`);
    const tagsResponse = await request(worker, denis, { path: "/api/recipe-tags" });
    const tags = await tagsResponse.json<RecipeTag[]>();

    await request(worker, asya, { method: "DELETE", path: `/api/recipe-tags/${soup.id}` });

    expect(tagged).toEqual(["Борщ"]);
    expect(tags).toEqual([{ id: soup.id, name: "Первое" }]);
    expect(await titlesOf(worker, denis)).toEqual(["Борщ", "Лазанья"]);
  });
});

describe("favourite Recipes", () => {
  test("are each Member's own", async () => {
    const worker = await startWithFamily();
    const recipe = await addRecipe(worker, denis, { title: "Борщ" });

    await addRecipe(worker, denis, { title: "Лазанья" });
    await request(worker, asya, {
      method: "PUT",
      path: `/api/recipes/${recipe.id}/favorite`,
      body: { isFavorite: true },
    });

    expect(await titlesOf(worker, asya, "?favorite=true")).toEqual(["Борщ"]);
    expect(await titlesOf(worker, denis, "?favorite=true")).toEqual([]);
  });
});

describe("a Recipe's photos", () => {
  test("stay out of «Все фото»", async () => {
    const worker = await startWithFamily();
    const own = await uploaded(worker, { size: 1, takenAt: null });
    const other = await uploaded(worker, { size: 2, takenAt: null });

    await addRecipe(worker, denis, { photoIds: [own.id] });

    const all = await request(worker, denis, { path: "/api/photos" });
    const photos = await all.json<Photo[]>();

    expect(photos.map(({ id }) => id)).toEqual([other.id]);
  });
});
