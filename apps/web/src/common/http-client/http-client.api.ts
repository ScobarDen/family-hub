import { atom, wrap } from "@reatom/core";
import type { z } from "zod";

const unauthorizedStatus = 401;
// Telegram WebViews on a bad network can leave a request pending indefinitely.
const defaultTimeoutMs = 15_000;

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Request failed with status ${status}`);
    this.name = "HttpError";
    this.status = status;
  }
}

type Fetch = (input: URL, init: RequestInit) => Promise<Response>;

type HttpClientOptions = {
  baseUrl: string;
  fetch: Fetch;
  timeoutMs?: number;
};

type RequestOptions<Schema extends z.ZodType> = {
  schema: Schema;
  method?: "GET" | "POST";
  body?: unknown;
};

export function createHttpClient({
  baseUrl,
  fetch,
  timeoutMs = defaultTimeoutMs,
}: HttpClientOptions) {
  const token = atom<string | undefined>(undefined, "httpClient.token");
  const isSessionLost = atom(false, "httpClient.isSessionLost");

  function headersFor(body: unknown): Headers {
    const headers = new Headers();
    const currentToken = token();

    if (body !== undefined) {
      headers.set("content-type", "application/json");
    }

    if (currentToken !== undefined) {
      headers.set("authorization", `Bearer ${currentToken}`);
    }

    return headers;
  }

  async function request<Schema extends z.ZodType>(
    path: string,
    { schema, method = "GET", body }: RequestOptions<Schema>,
  ): Promise<z.infer<Schema>> {
    const response = await wrap(
      fetch(new URL(path, baseUrl), {
        method,
        headers: headersFor(body),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      }),
    );

    if (response.status === unauthorizedStatus) {
      isSessionLost.set(true);
    }

    if (!response.ok) {
      throw new HttpError(response.status);
    }

    return schema.parse(await wrap(response.json()));
  }

  return { request, token, isSessionLost };
}

export type HttpClient = ReturnType<typeof createHttpClient>;
