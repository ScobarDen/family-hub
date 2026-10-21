import { describe, expect, test } from "vite-plus/test";

import type { FeedPage, Photo, Recipe } from "@family-hub/contract";

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

async function cook(
  worker: Worker,
  user: TelegramUserFixture,
  { recipeId, cookedAt = null }: { recipeId: string; cookedAt?: number | null },
) {
  return request(worker, user, {
    method: "POST",
    path: `/api/recipes/${recipeId}/cooked`,
    body: { cookedAt },
  });
}

describe("«🍳 Приготовили»", () => {
  test("counts the times a Recipe was cooked and when it was last", async () => {
    const worker = await startWithFamily();
    const recipe = await addRecipe(worker, denis, {});

    await cook(worker, asya, { recipeId: recipe.id, cookedAt: Date.parse("2026-09-20T18:00:00Z") });

    const response = await cook(worker, denis, { recipeId: recipe.id });
    const saved = await response.json<Recipe>();

    expect(saved).toMatchObject({ cookedCount: 2, lastCookedAt: worker.clock.now() });
    expect(saved.cooks.map(({ memberName, isOwn }) => [memberName, isOwn])).toEqual([
      ["Денис", true],
      ["Ася", false],
    ]);
  });

  test("is never in the future and taken back only by whoever marked it", async () => {
    const worker = await startWithFamily();
    const recipe = await addRecipe(worker, denis, {});
    const future = await cook(worker, asya, {
      recipeId: recipe.id,
      cookedAt: worker.clock.now() + 3_600_000,
    });
    const marked = await cook(worker, asya, { recipeId: recipe.id });
    const { cooks } = await marked.json<Recipe>();
    const [mark] = cooks;
    const path = `/api/recipes/${recipe.id}/cooked/${mark?.id}`;
    const byDenis = await request(worker, denis, { method: "DELETE", path });
    const byAsya = await request(worker, asya, { method: "DELETE", path });

    expect([future.status, byDenis.status, byAsya.status]).toEqual([400, 403, 200]);
    const after = await byAsya.json<Recipe>();

    expect(after.cookedCount).toBe(0);
  });

  test("sorts the list by what was cooked longest ago, never cooked first", async () => {
    const worker = await startWithFamily();
    const borscht = await addRecipe(worker, denis, { title: "Борщ" });
    const lasagna = await addRecipe(worker, denis, { title: "Лазанья" });

    await addRecipe(worker, denis, { title: "Сырники" });
    await cook(worker, asya, {
      recipeId: lasagna.id,
      cookedAt: Date.parse("2026-09-01T18:00:00Z"),
    });
    await cook(worker, asya, {
      recipeId: borscht.id,
      cookedAt: Date.parse("2026-09-25T18:00:00Z"),
    });

    const response = await request(worker, denis, { path: "/api/recipes?sort=forgotten" });
    const recipes = await response.json<Recipe[]>();

    expect(recipes.map(({ title }) => title)).toEqual(["Сырники", "Лазанья", "Борщ"]);
  });

  test("shows in the Feed with the Recipe's photo", async () => {
    const worker = await startWithFamily();
    const photo = await uploaded(worker, { size: 1, takenAt: null });
    const recipe = await addRecipe(worker, denis, { title: "Лазанья", photoIds: [photo.id] });

    await cook(worker, asya, { recipeId: recipe.id });

    const response = await request(worker, denis, { path: "/api/feed" });
    const feed = await response.json<FeedPage>();

    expect(feed.activity.find(({ kind }) => kind === "cooked")).toMatchObject({
      memberName: "Ася",
      title: "Лазанья",
      recipeId: recipe.id,
      photoCount: 1,
      photos: [{ id: photo.id }],
    });
  });
});
