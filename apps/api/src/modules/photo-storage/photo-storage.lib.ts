import type { ChatMemberUpdated } from "@grammyjs/types";

import type { PhotoStorage } from "@family-hub/contract";

import type { ChannelRow } from "./photo-storage.repo.ts";

export type ChannelChange =
  | { kind: "admin"; channelId: number; channelTitle: string; canPost: boolean }
  | { kind: "gone"; channelId: number };

const goneStatuses = new Set(["left", "kicked", "member", "restricted"]);

export function channelChangeOf({
  chat,
  new_chat_member: member,
}: ChatMemberUpdated): ChannelChange | undefined {
  if (chat.type !== "channel") {
    return undefined;
  }

  if (member.status === "administrator") {
    return {
      kind: "admin",
      channelId: chat.id,
      channelTitle: chat.title,
      canPost: member.can_post_messages === true,
    };
  }

  return goneStatuses.has(member.status) ? { kind: "gone", channelId: chat.id } : undefined;
}

export function storageOf(row: ChannelRow | undefined): PhotoStorage {
  if (row?.channelId === null || row === undefined) {
    return { status: "none", channelTitle: null };
  }

  return {
    status: row.isConnected === true ? "connected" : "disconnected",
    channelTitle: row.channelTitle,
  };
}

export function connectedText({
  channelTitle,
  familyName,
}: {
  channelTitle: string;
  familyName: string;
}) {
  return `Канал «${channelTitle}» подключён: здесь будут храниться фото семьи «${familyName}».`;
}

export function cannotPostText(channelTitle: string) {
  return `Бот стал админом канала «${channelTitle}», но без права публиковать сообщения. Включите его, чтобы хранить там фото семьи.`;
}

export function disconnectedText({
  channelTitle,
  familyName,
}: {
  channelTitle: string;
  familyName: string;
}) {
  return `Хранилище фото семьи «${familyName}» отключено: бот больше не админ канала «${channelTitle}». Загруженные фото недоступны, а новые не загрузить, пока вы не подключите канал снова.`;
}
