import type { Message } from "@grammyjs/types";

import {
  BotApiError,
  type BotApi,
  type BotMethod,
  type BotParams,
  type BotResult,
} from "@/common/telegram";

type ChatId = number | string;
type BotCall = { [Method in BotMethod]: { method: Method; params: BotParams<Method> } }[BotMethod];

type FakeBotState = {
  calls: BotCall[];
  blockedChats: Set<string>;
  pendingRetryAfterSeconds: number | undefined;
  lastMessageId: number;
};

function rejectUndeliverable(state: FakeBotState, params: unknown): void {
  if (state.pendingRetryAfterSeconds !== undefined) {
    const retryAfter = state.pendingRetryAfterSeconds;

    state.pendingRetryAfterSeconds = undefined;
    throw new BotApiError(429, `Too Many Requests: retry after ${retryAfter}`, retryAfter);
  }

  const chatId = (params as { chat_id?: ChatId } | undefined)?.chat_id;

  if (chatId !== undefined && state.blockedChats.has(String(chatId))) {
    throw new BotApiError(403, "Forbidden: bot was blocked by the user");
  }
}

function respond(state: FakeBotState, call: BotCall): unknown {
  if (call.method !== "sendMessage") {
    return true;
  }

  state.lastMessageId += 1;

  return {
    message_id: state.lastMessageId,
    date: 0,
    chat: { id: Number(call.params.chat_id), type: "private", first_name: "" },
    text: call.params.text,
  } satisfies Message.TextMessage;
}

export function createFakeBotApi() {
  const state: FakeBotState = {
    calls: [],
    blockedChats: new Set(),
    pendingRetryAfterSeconds: undefined,
    lastMessageId: 0,
  };

  const api: BotApi = {
    async call<Method extends BotMethod>(method: Method, params: BotParams<Method>) {
      rejectUndeliverable(state, params);

      const call = { method, params } as BotCall;

      state.calls.push(call);

      return respond(state, call) as BotResult<Method>;
    },
  };

  function paramsOf<Method extends BotMethod>(method: Method) {
    return state.calls
      .filter((call) => call.method === method)
      .map((call) => call.params as BotParams<Method>);
  }

  return {
    api,
    sentMessages: () => paramsOf("sendMessage"),
    editedMessages: () => paramsOf("editMessageText"),
    blockChat(chatId: ChatId) {
      state.blockedChats.add(String(chatId));
    },
    rateLimitNextCall(retryAfterSeconds: number) {
      state.pendingRetryAfterSeconds = retryAfterSeconds;
    },
  };
}
