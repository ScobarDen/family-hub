import type { ApiMethods } from "@grammyjs/types";

type Methods = ApiMethods<Blob>;

export type BotMethod = keyof Methods;
export type BotParams<Method extends BotMethod> = Parameters<Methods[Method]>[0];
export type BotResult<Method extends BotMethod> = ReturnType<Methods[Method]>;

export type BotApi = {
  call<Method extends BotMethod>(
    method: Method,
    params: BotParams<Method>,
  ): Promise<BotResult<Method>>;
  // A file's URL carries the bot token, so only the Worker ever fetches it.
  file(filePath: string): Promise<Response>;
};

export class BotApiError extends Error {
  readonly errorCode: number;
  readonly retryAfterSeconds: number | undefined;

  constructor(errorCode: number, description: string, retryAfterSeconds?: number) {
    super(description);
    this.name = "BotApiError";
    this.errorCode = errorCode;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// For messages sent after a decision is committed: a blocked chat or a rate limit must not undo it.
export async function ignoringBotErrors(call: Promise<unknown>): Promise<void> {
  try {
    await call;
  } catch (error) {
    if (!(error instanceof BotApiError)) {
      throw error;
    }
  }
}

type BotApiResponse<Result> =
  | { ok: true; result: Result }
  | {
      ok: false;
      error_code: number;
      description: string;
      parameters?: { retry_after?: number };
    };

// A file goes up as multipart, where every other field is a string and objects are JSON.
function bodyOf(params: object | undefined): { body: BodyInit; headers: HeadersInit } {
  const fields = Object.entries(params ?? {});

  if (!fields.some(([, value]) => value instanceof Blob)) {
    return { body: JSON.stringify(params ?? {}), headers: { "content-type": "application/json" } };
  }

  const form = new FormData();

  for (const [key, value] of fields) {
    if (value instanceof Blob) {
      form.append(key, value, "photo.jpg");
    } else if (value !== undefined) {
      form.append(key, typeof value === "object" ? JSON.stringify(value) : String(value));
    }
  }

  return { body: form, headers: {} };
}

export function createHttpBotApi(token: string): BotApi {
  return {
    async file(filePath) {
      return fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
    },
    async call(method, params) {
      const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        ...bodyOf(params ?? undefined),
      });
      const body = await response.json<BotApiResponse<BotResult<typeof method>>>();

      if (!body.ok) {
        throw new BotApiError(body.error_code, body.description, body.parameters?.retry_after);
      }

      return body.result;
    },
  };
}
