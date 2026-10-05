import type { ApiMethods } from "@grammyjs/types";

type Methods = ApiMethods<Blob>;

export type BotMethod = keyof Methods;
export type BotParams<M extends BotMethod> = Parameters<Methods[M]>[0];
export type BotResult<M extends BotMethod> = ReturnType<Methods[M]>;

export type BotApi = {
  call<M extends BotMethod>(method: M, params: BotParams<M>): Promise<BotResult<M>>;
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

type BotApiResponse =
  | { ok: true; result: unknown }
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
      const body = (await response.json()) as BotApiResponse;
      if (!body.ok) {
        throw new BotApiError(body.error_code, body.description, body.parameters?.retry_after);
      }
      return body.result as BotResult<typeof method>;
    },
  };
}
