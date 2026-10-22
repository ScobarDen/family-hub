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
  pendingRateLimit: { retryAfterSeconds: number; method: BotMethod | undefined } | undefined;
  lastMessageId: number;
  files: string[];
};

function rejectUndeliverable(state: FakeBotState, method: BotMethod, params: unknown): void {
  const limit = state.pendingRateLimit;

  if (limit !== undefined && (limit.method === undefined || limit.method === method)) {
    state.pendingRateLimit = undefined;
    throw new BotApiError(
      429,
      `Too Many Requests: retry after ${limit.retryAfterSeconds}`,
      limit.retryAfterSeconds,
    );
  }

  const chatId = (params as { chat_id?: ChatId } | undefined)?.chat_id;

  if (chatId !== undefined && state.blockedChats.has(String(chatId))) {
    throw new BotApiError(403, "Forbidden: bot was blocked by the user");
  }
}

// Telegram answers a photo with its sizes; the fake keeps one per variant the app stores.
function photoMessage(state: FakeBotState, params: BotParams<"sendPhoto">): Message.PhotoMessage {
  state.lastMessageId += 1;

  const photo = params.photo as Blob;
  const unique = `unique-${photo.size}`;

  return {
    message_id: state.lastMessageId,
    date: 0,
    chat: { id: Number(params.chat_id), type: "channel", title: "" },
    photo: [320, 1280, 2560].map((side) => ({
      file_id: `file-${side}-${state.lastMessageId}`,
      file_unique_id: `${unique}-${side}`,
      width: side,
      height: (side * 3) / 4,
    })),
  };
}

function respond(state: FakeBotState, call: BotCall): unknown {
  if (call.method === "getMe") {
    return { id: 1, is_bot: true, first_name: "Family Hub", username: "family_hub_test_bot" };
  }

  if (call.method === "savePreparedInlineMessage") {
    return { id: `prepared-${state.calls.length}`, expiration_date: 0 };
  }

  if (call.method === "sendPhoto") {
    return photoMessage(state, call.params);
  }

  if (call.method === "getFile") {
    const id = call.params.file_id;

    return {
      file_id: id,
      file_unique_id: "",
      file_path: id.startsWith("voice") ? `voice/${id}.oga` : `photos/${id}.jpg`,
    };
  }

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

async function fileOf(state: FakeBotState, filePath: string): Promise<Response> {
  state.files.push(filePath);

  return filePath.startsWith("voice/")
    ? new Response(`ogg:${filePath}`, { headers: { "content-type": "audio/ogg" } })
    : new Response(`jpeg:${filePath}`, { headers: { "content-type": "image/jpeg" } });
}

function emptyState(): FakeBotState {
  return {
    calls: [],
    blockedChats: new Set(),
    pendingRateLimit: undefined,
    lastMessageId: 0,
    files: [],
  };
}

export function createFakeBotApi() {
  const state = emptyState();

  const api: BotApi = {
    file: async (filePath: string) => fileOf(state, filePath),
    async call<Method extends BotMethod>(method: Method, params: BotParams<Method>) {
      rejectUndeliverable(state, method, params);

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
    answeredCallbacks: () => paramsOf("answerCallbackQuery"),
    preparedMessages: () => paramsOf("savePreparedInlineMessage"),
    sentPhotos: () => paramsOf("sendPhoto"),
    countCalls: (method: BotMethod) => paramsOf(method).length,
    downloadedFiles: () => [...state.files],
    blockChat(chatId: ChatId) {
      state.blockedChats.add(String(chatId));
    },
    unblockChat(chatId: ChatId) {
      state.blockedChats.delete(String(chatId));
    },
    rateLimitNextCall(retryAfterSeconds: number, method?: BotMethod) {
      state.pendingRateLimit = { retryAfterSeconds, method };
    },
  };
}
