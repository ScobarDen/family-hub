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

type BotApiResponse<Result> =
  | { ok: true; result: Result }
  | {
      ok: false;
      error_code: number;
      description: string;
      parameters?: { retry_after?: number };
    };

export function createHttpBotApi(token: string): BotApi {
  return {
    async call(method, params) {
      const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(params ?? {}),
      });
      const body = await response.json<BotApiResponse<BotResult<typeof method>>>();

      if (!body.ok) {
        throw new BotApiError(body.error_code, body.description, body.parameters?.retry_after);
      }

      return body.result;
    },
  };
}
