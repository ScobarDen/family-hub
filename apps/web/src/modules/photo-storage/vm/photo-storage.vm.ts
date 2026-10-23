import { computed, withAsyncData, wrap } from "@reatom/core";

import type { PhotoStorage } from "@family-hub/contract";

import type { PhotoStorageApi } from "../photo-storage.api.ts";

export type PhotoStorageView = { title: string; description: string; isConnected: boolean };

type PhotoStorageDependencies = {
  api: PhotoStorageApi;
  isFamilyOwner: () => boolean;
};

const ownerSteps =
  "Создайте приватный канал в Telegram и добавьте туда бота семьи админом с правом публиковать сообщения.";

function viewOf({ status, channelTitle }: PhotoStorage, isOwner: boolean): PhotoStorageView {
  if (status === "connected") {
    return {
      title: `Канал «${channelTitle ?? ""}»`,
      description: "Подключён: фото семьи хранятся в нём.",
      isConnected: true,
    };
  }

  if (status === "disconnected") {
    return {
      title: "Канал отключён",
      description: isOwner
        ? `Бот больше не админ канала «${channelTitle ?? ""}». ${ownerSteps}`
        : "Бот больше не админ канала семьи. Попросите владельца подключить его снова.",
      isConnected: false,
    };
  }

  return {
    title: "Канал не подключён",
    description: isOwner ? ownerSteps : "Владелец семьи ещё не подключил канал для фото.",
    isConnected: false,
  };
}

export function reatomPhotoStorage({ api, isFamilyOwner }: PhotoStorageDependencies) {
  const status = computed(async () => wrap(api.status()), "photoStorage.status").extend(
    withAsyncData(),
  );

  return {
    view: computed((): PhotoStorageView | undefined => {
      const storage = status.data();

      return storage === undefined ? undefined : viewOf(storage, isFamilyOwner());
    }, "photoStorage.view"),

    canSetUp: computed((): boolean => {
      const storage = status.data();

      return storage !== undefined && storage.status !== "connected" && isFamilyOwner();
    }, "photoStorage.canSetUp"),

    // Every photo upload in the app reads this: without a connected channel there is nowhere to put one.
    uploadHint: computed((): string | undefined => {
      const storage = status.data();

      if (storage?.status === "connected") {
        return undefined;
      }

      return isFamilyOwner()
        ? "Загрузка фото выключена: подключите канал для фото в Профиле."
        : "Загрузка фото выключена: владелец семьи ещё не подключил канал для фото.";
    }, "photoStorage.uploadHint"),
  };
}

export type PhotoStorageModel = ReturnType<typeof reatomPhotoStorage>;
