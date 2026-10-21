import { atom, noop, wrap } from "@reatom/core";
import type { z } from "zod";

import { apiError, type ErrorCode } from "@family-hub/contract";

const unauthorizedStatus = 401;
// Telegram WebViews on a bad network can leave a request pending indefinitely.
const defaultTimeoutMs = 15_000;

export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode | undefined;

  constructor(status: number, code?: ErrorCode) {
    super(`Request failed with status ${status}`);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

async function errorCodeOf(response: Response): Promise<ErrorCode | undefined> {
  const body: unknown = await wrap(response.json().catch(noop));

  return apiError.safeParse(body).data?.code;
}

type Fetch = (input: URL, init: RequestInit) => Promise<Response>;

type HttpClientOptions = {
  baseUrl: string;
  fetch: Fetch;
  timeoutMs?: number;
};

type RequestOptions<Schema extends z.ZodType> = {
  schema: Schema;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
};

// A FormData body sets its own multipart content type.
function headersFor(body: unknown, token: string | undefined): Headers {
  const headers = new Headers();

  if (body !== undefined && !(body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }

  if (token !== undefined) {
    headers.set("authorization", `Bearer ${token}`);
  }

  return headers;
}

export function createHttpClient({
  baseUrl,
  fetch,
  timeoutMs = defaultTimeoutMs,
}: HttpClientOptions) {
  const token = atom<string | undefined>(undefined, "httpClient.token");
  const isSessionLost = atom(false, "httpClient.isSessionLost");

  async function request<Schema extends z.ZodType>(
    path: string,
    { schema, method = "GET", body }: RequestOptions<Schema>,
  ): Promise<z.infer<Schema>> {
    const response = await wrap(
      fetch(new URL(path, baseUrl), {
        method,
        headers: headersFor(body, token()),
        body: body === undefined || body instanceof FormData ? body : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      }),
    );

    if (response.status === unauthorizedStatus) {
      isSessionLost.set(true);
    }

    if (!response.ok) {
      throw new HttpError(response.status, await wrap(errorCodeOf(response)));
    }

    return schema.parse(await wrap(response.json()));
  }

  // The Worker hands out its own paths, such as signed photo links; the browser needs them whole.
  function url(path: string): string {
    return new URL(path, baseUrl).toString();
  }

  return { request, url, token, isSessionLost };
}

export type HttpClient = ReturnType<typeof createHttpClient>;
