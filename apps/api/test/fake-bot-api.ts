import type { Message } from "@grammyjs/types";
import {
  BotApiError,
  type BotApi,
  type BotMethod,
  type BotParams,
  type BotResult,
} from "@/common/telegram";

type ChatId = number | string;
type BotCall = { [M in BotMethod]: { method: M; params: BotParams<M> } }[BotMethod];

export function createFakeBotApi() {
  const calls: BotCall[] = [];
  const blockedChats = new Set<string>();
  let pendingRetryAfterSeconds: number | undefined;
  let lastMessageId = 0;

  const respond = (call: BotCall): unknown => {
    if (call.method !== "sendMessage") return true;
    lastMessageId += 1;
    return {
      message_id: lastMessageId,
      date: 0,
      chat: { id: Number(call.params.chat_id), type: "private", first_name: "" },
      text: call.params.text,
    } satisfies Message.TextMessage;
  };

  const api: BotApi = {
    async call<M extends BotMethod>(method: M, params: BotParams<M>) {
      if (pendingRetryAfterSeconds !== undefined) {
        const retryAfter = pendingRetryAfterSeconds;
        pendingRetryAfterSeconds = undefined;
        throw new BotApiError(429, `Too Many Requests: retry after ${retryAfter}`, retryAfter);
      }
      const chatId = (params as { chat_id?: ChatId } | undefined)?.chat_id;
      if (chatId !== undefined && blockedChats.has(String(chatId))) {
        throw new BotApiError(403, "Forbidden: bot was blocked by the user");
      }
      const call = { method, params } as BotCall;
      calls.push(call);
      return respond(call) as BotResult<M>;
    },
  };

  const paramsOf = <M extends BotMethod>(method: M) =>
    calls.filter((call) => call.method === method).map((call) => call.params as BotParams<M>);

  return {
    api,
    sentMessages: () => paramsOf("sendMessage"),
    editedMessages: () => paramsOf("editMessageText"),
    blockChat(chatId: ChatId) {
      blockedChats.add(String(chatId));
    },
    rateLimitNextCall(retryAfterSeconds: number) {
      pendingRetryAfterSeconds = retryAfterSeconds;
    },
  };
}
