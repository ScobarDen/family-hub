import type { InlineKeyboardButton, InlineQueryResult } from "@grammyjs/types";
import { describe, expect, test } from "vite-plus/test";

import type { PreparedMessage, Recipe } from "@family-hub/contract";

import { addTo, createAlbum, startWithFamily, uploaded, type Worker } from "./album-fixtures.ts";
import { asya, denis, request } from "./worker-harness.ts";

const appLink = "https://t.me/family_hub_test_bot?startapp";

function buttonsOf(result: InlineQueryResult | undefined): InlineKeyboardButton[] {
  return result?.reply_markup?.inline_keyboard.flat() ?? [];
}

async function addRecipe(worker: Worker, change: Record<string, unknown>) {
  const response = await request(worker, denis, {
    method: "POST",
    path: "/api/recipes",
    body: { title: "Лазанья", ingredients: "", method: null, ...change },
  });

  return response.json<Recipe>();
}

async function share(worker: Worker, path: string) {
  const response = await request(worker, asya, { method: "POST", path });

  return { status: response.status, body: await response.json<PreparedMessage>() };
}

describe("sharing a Recipe", () => {
  test("prepares its photo with the title and ingredients and an «Открыть» button", async () => {
    const worker = await startWithFamily();
    const photo = await uploaded(worker, { size: 1, takenAt: null });
    const recipe = await addRecipe(worker, {
      ingredients: "Листы лазаньи\nФарш 500 г\nСыр",
      photoIds: [photo.id],
    });

    const shared = await share(worker, `/api/recipes/${recipe.id}/share`);
    const [prepared] = worker.bot.preparedMessages();

    expect(shared.body.preparedMessageId).toMatch(/^prepared-/);
    expect(prepared?.user_id).toBe(asya.id);
    expect(prepared?.result).toMatchObject({
      type: "photo",
      photo_file_id: "file-2560-1",
      caption: "Лазанья\n\n• Листы лазаньи\n• Фарш 500 г\n• Сыр",
    });
    expect(buttonsOf(prepared?.result)).toEqual([
      { text: "Открыть", url: `${appLink}=recipe_${recipe.id}` },
    ]);
  });

  test("prepares a text card for a Recipe without a photo", async () => {
    const worker = await startWithFamily();
    const recipe = await addRecipe(worker, { ingredients: "Фарш" });

    await share(worker, `/api/recipes/${recipe.id}/share`);
    const [prepared] = worker.bot.preparedMessages();

    expect(prepared?.result).toMatchObject({
      type: "article",
      title: "Лазанья",
      input_message_content: { message_text: "Лазанья\n\n• Фарш" },
    });
    expect(buttonsOf(prepared?.result)).toEqual([
      { text: "Открыть", url: `${appLink}=recipe_${recipe.id}` },
    ]);
  });

  test("keeps the ingredients that fit a photo caption and marks the rest cut", async () => {
    const worker = await startWithFamily();
    const photo = await uploaded(worker, { size: 1, takenAt: null });
    const line = "а".repeat(98);
    const recipe = await addRecipe(worker, {
      ingredients: Array.from({ length: 20 }, () => line).join("\n"),
      photoIds: [photo.id],
    });

    await share(worker, `/api/recipes/${recipe.id}/share`);
    const [prepared] = worker.bot.preparedMessages();
    const caption = prepared?.result.type === "photo" ? prepared.result.caption : undefined;

    expect(caption).toBe(
      `Лазанья\n\n${Array.from({ length: 10 }, () => `• ${line}`).join("\n")}\n…`,
    );
  });

  test("is refused for a Recipe the Family does not have", async () => {
    const worker = await startWithFamily();

    const shared = await share(worker, "/api/recipes/missing/share");

    expect(shared.status).toBe(404);
    expect(worker.bot.preparedMessages()).toEqual([]);
  });
});

describe("sharing a photo", () => {
  test("prepares the photo with its Album's title and an «Открыть» button to the Album", async () => {
    const worker = await startWithFamily();
    const album = await createAlbum(worker, denis, "Дача");
    const photo = await uploaded(worker, { size: 1, takenAt: null });

    await addTo(worker, album.id, [photo]);
    const shared = await share(worker, `/api/albums/${album.id}/photos/${photo.id}/share`);
    const [prepared] = worker.bot.preparedMessages();

    expect(shared.body.preparedMessageId).toMatch(/^prepared-/);
    expect(prepared?.user_id).toBe(asya.id);
    expect(prepared?.result).toMatchObject({
      type: "photo",
      photo_file_id: "file-2560-1",
      caption: "Дача",
    });
    expect(buttonsOf(prepared?.result)).toEqual([
      { text: "Открыть", url: `${appLink}=album_${album.id}` },
    ]);
  });

  test("is refused for a photo that is not in the Album", async () => {
    const worker = await startWithFamily();
    const album = await createAlbum(worker, denis, "Дача");
    const photo = await uploaded(worker, { size: 1, takenAt: null });

    const shared = await share(worker, `/api/albums/${album.id}/photos/${photo.id}/share`);

    expect(shared.status).toBe(404);
    expect(worker.bot.preparedMessages()).toEqual([]);
  });
});
