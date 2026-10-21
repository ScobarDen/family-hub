import type { ChatMember, ChatMemberAdministrator, Update } from "@grammyjs/types";
import { describe, expect, test } from "vite-plus/test";

import type { PhotoStorage } from "@family-hub/contract";

import { signInitData, type TelegramUserFixture } from "./init-data.ts";
import { startWorker } from "./worker-harness.ts";

const now = "2026-10-04T09:00:00Z";
const denis = { id: 111, first_name: "Денис" };
const asya = { id: 222, first_name: "Ася" };
const channel = { id: -100_123, type: "channel", title: "Фото Гущиных" } as const;
const bot = { id: 1, is_bot: true, first_name: "Family Hub" };

type Worker = Awaited<ReturnType<typeof startWithFamily>>;

const admin: ChatMemberAdministrator = {
  status: "administrator",
  user: bot,
  can_be_edited: false,
  is_anonymous: false,
  can_manage_chat: true,
  can_delete_messages: true,
  can_manage_video_chats: false,
  can_restrict_members: false,
  can_promote_members: false,
  can_change_info: false,
  can_invite_users: false,
  can_post_stories: false,
  can_edit_stories: false,
  can_delete_stories: false,
  can_send_welcome_messages: false,
  can_post_messages: true,
};

function chatMemberUpdate(
  by: TelegramUserFixture,
  member: ChatMember,
  chat: { id: number; type: "channel" | "supergroup"; title: string } = channel,
): Update {
  return {
    update_id: 1,
    my_chat_member: {
      chat,
      from: { ...by, is_bot: false },
      date: 0,
      old_chat_member: { status: "left", user: bot },
      new_chat_member: member,
    },
  };
}

async function startWithFamily() {
  const worker = startWorker({ now });
  const { familyId } = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });

  await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });

  return worker;
}

async function storageSeenBy(worker: Worker, user: TelegramUserFixture): Promise<PhotoStorage> {
  const session = await worker.request("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      initData: signInitData({ botToken: worker.env.BOT_TOKEN, user, authDate: now }),
    }),
  });
  const { token = "" } = await session.json<{ token?: string }>();
  const response = await worker.request("/api/family/photo-storage", {
    headers: { authorization: `Bearer ${token}` },
  });

  return response.json<PhotoStorage>();
}

describe("connecting the Photo Storage", () => {
  test("is not there until the Family Owner adds the bot to a channel", async () => {
    const worker = await startWithFamily();

    expect(await storageSeenBy(worker, asya)).toEqual({ status: "none", channelTitle: null });
  });

  test("links the channel the Family Owner made the bot an admin of", async () => {
    const worker = await startWithFamily();

    await worker.webhook(chatMemberUpdate(denis, admin));

    expect(await storageSeenBy(worker, asya)).toEqual({
      status: "connected",
      channelTitle: "Фото Гущиных",
    });
    expect(worker.bot.sentMessages()).toEqual([
      {
        chat_id: denis.id,
        text: "Канал «Фото Гущиных» подключён: здесь будут храниться фото семьи «Гущины».",
      },
    ]);
  });

  test("ignores a channel added by someone who is not the Family Owner", async () => {
    const worker = await startWithFamily();

    await worker.webhook(chatMemberUpdate(asya, admin));

    expect(await storageSeenBy(worker, denis)).toMatchObject({ status: "none" });
    expect(worker.bot.sentMessages()).toEqual([]);
  });

  test("asks for the right to post instead of linking a channel the bot cannot post to", async () => {
    const worker = await startWithFamily();

    await worker.webhook(chatMemberUpdate(denis, { ...admin, can_post_messages: false }));

    expect(await storageSeenBy(worker, denis)).toMatchObject({ status: "none" });
    expect(worker.bot.sentMessages()).toEqual([
      {
        chat_id: denis.id,
        text: "Бот стал админом канала «Фото Гущиных», но без права публиковать сообщения. Включите его, чтобы хранить там фото семьи.",
      },
    ]);
  });

  test("ignores groups, which are no Photo Storage", async () => {
    const worker = await startWithFamily();

    await worker.webhook(
      chatMemberUpdate(denis, admin, { id: -100_456, type: "supergroup", title: "Чат" }),
    );

    expect(await storageSeenBy(worker, denis)).toMatchObject({ status: "none" });
  });
});

describe("losing the Photo Storage", () => {
  test.each([
    ["the bot is removed", { status: "left", user: bot }],
    ["the bot is banned or the channel deleted", { status: "kicked", user: bot, until_date: 0 }],
  ] satisfies Array<[string, ChatMember]>)(
    "marks it disconnected and tells the Family Owner when %s",
    async (_case, member) => {
      const worker = await startWithFamily();

      await worker.webhook(chatMemberUpdate(denis, admin));
      await worker.webhook(chatMemberUpdate(asya, member));

      expect(await storageSeenBy(worker, asya)).toEqual({
        status: "disconnected",
        channelTitle: "Фото Гущиных",
      });
      expect(worker.bot.sentMessages().at(-1)).toEqual({
        chat_id: denis.id,
        text: "Хранилище фото семьи «Гущины» отключено: бот больше не админ канала «Фото Гущиных». Загруженные фото недоступны, а новые не загрузить, пока вы не подключите канал снова.",
      });
    },
  );

  test("connects again when the Family Owner adds the bot back", async () => {
    const worker = await startWithFamily();

    await worker.webhook(chatMemberUpdate(denis, admin));
    await worker.webhook(chatMemberUpdate(denis, { status: "left", user: bot }));
    await worker.webhook(chatMemberUpdate(denis, admin));

    expect(await storageSeenBy(worker, asya)).toMatchObject({ status: "connected" });
  });

  test("ignores a channel no Family uses", async () => {
    const worker = await startWithFamily();

    await worker.webhook(chatMemberUpdate(denis, { status: "left", user: bot }));

    expect(worker.bot.sentMessages()).toEqual([]);
  });
});
