import { context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { PhotoStorage } from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client";

import { createPhotoStorageApi } from "../photo-storage.api.ts";
import { reatomPhotoStorage } from "./photo-storage.vm.ts";

function startPhotoStorage(storage: PhotoStorage, { isFamilyOwner = true } = {}) {
  const client = createHttpClient({
    baseUrl: "https://api.family-hub.test",
    fetch: async () => Response.json(storage),
  });
  const model = reatomPhotoStorage({
    api: createPhotoStorageApi(client),
    isFamilyOwner: () => isFamilyOwner,
  });

  model.view.subscribe(noop);
  model.uploadHint.subscribe(noop);

  return model;
}

async function loaded(model: ReturnType<typeof startPhotoStorage>) {
  await vi.waitFor(() => {
    expect(model.view()).toBeDefined();
  });
}

beforeEach(() => {
  context.reset();
});

describe("the Photo Storage in the Profile", () => {
  test("names the connected channel and lets photos be uploaded", async () => {
    const model = startPhotoStorage({ status: "connected", channelTitle: "Фото Гущиных" });

    await loaded(model);

    expect(model.view()).toEqual({
      title: "Канал «Фото Гущиных»",
      description: "Подключён: фото семьи хранятся в нём.",
      isConnected: true,
    });
    expect(model.uploadHint()).toBeUndefined();
  });

  test("gives the Family Owner the steps to connect a channel", async () => {
    const model = startPhotoStorage({ status: "none", channelTitle: null });

    await loaded(model);

    expect(model.view()?.description).toBe(
      "Создайте приватный канал в Telegram и добавьте туда бота семьи админом с правом публиковать сообщения.",
    );
    expect(model.uploadHint()).toBe(
      "Загрузка фото выключена: подключите канал для фото в Профиле.",
    );
  });

  test("tells another Member who can fix a lost channel", async () => {
    const model = startPhotoStorage(
      { status: "disconnected", channelTitle: "Фото Гущиных" },
      { isFamilyOwner: false },
    );

    await loaded(model);

    expect(model.view()).toMatchObject({
      title: "Канал отключён",
      description: "Бот больше не админ канала семьи. Попросите владельца подключить его снова.",
    });
    expect(model.uploadHint()).toBe(
      "Загрузка фото выключена: владелец семьи ещё не подключил канал для фото.",
    );
  });
});
