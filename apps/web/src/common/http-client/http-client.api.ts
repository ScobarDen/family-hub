import { abortVar, action, atom, noop, reatomBoolean, withChangeHook, wrap } from "@reatom/core";
import type { z } from "zod";

import { apiError, sessionToken, type ErrorCode } from "@family-hub/contract";

const unauthorizedStatus = 401;
// Half the Worker's 24-hour token: an app back on screen renews well before the token expires.
const renewAfterMs = 43_200_000;
// Telegram WebViews on a bad network can leave a request pending indefinitely.
const defaultTimeoutMs = 15_000;

export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode | undefined;
  // How long the server asks to wait before trying again, from Retry-After.
  readonly retryAfterSeconds: number | undefined;

  constructor(status: number, code?: ErrorCode, retryAfterSeconds?: number) {
    super(`Request failed with status ${status}`);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// A refusal the server names by its code becomes the caller's outcome; anything else stays an error.
export function refusalOf<Outcome>(
  error: unknown,
  refusals: Partial<Record<ErrorCode, Outcome>>,
): Outcome | undefined {
  return error instanceof HttpError && error.code !== undefined ? refusals[error.code] : undefined;
}

function retryAfterOf(response: Response): number | undefined {
  const seconds = Number(response.headers.get("retry-after"));

  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

async function errorCodeOf(response: Response): Promise<ErrorCode | undefined> {
  const body: unknown = await wrap(response.json().catch(noop));

  return apiError.safeParse(body).data?.code;
}

type Fetch = (input: URL, init: RequestInit) => Promise<Response>;

type Page = EventTarget & { readonly visibilityState: DocumentVisibilityState };

type HttpClientOptions = {
  baseUrl: string;
  fetch: Fetch;
  timeoutMs?: number;
  // The token renews when this page comes back on screen.
  page?: Page;
  now?: () => number;
};

type RequestOptions<Schema extends z.ZodType> = {
  schema: Schema;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
};

function isRaw(body: unknown): body is FormData | Blob {
  return body instanceof FormData || body instanceof Blob;
}

// A FormData body sets its own multipart content type; a Blob, such as a recording, carries its own.
function headersFor(body: unknown, token: string | undefined): Headers {
  const headers = new Headers();

  if (body instanceof Blob) {
    headers.set("content-type", body.type);
  } else if (body !== undefined && !isRaw(body)) {
    headers.set("content-type", "application/json");
  }

  if (token !== undefined) {
    headers.set("authorization", `Bearer ${token}`);
  }

  return headers;
}

// A request stops with the Reatom process that made it, or after the timeout.
async function fetchUntilAborted(
  fetch: Fetch,
  { url, init, timeoutMs }: { url: URL; init: RequestInit; timeoutMs: number },
): Promise<Response> {
  const { controller, unsubscribe } = abortVar.subscribe();

  try {
    return await wrap(
      fetch(url, {
        ...init,
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(timeoutMs)]),
      }),
    );
  } finally {
    unsubscribe();
  }
}

function reatomSessionToken(now: () => number) {
  const issuedAt = atom(0, "httpClient.tokenIssuedAt");
  const token = atom<string | undefined>(undefined, "httpClient.token").extend(
    withChangeHook(() => {
      issuedAt.set(now());
    }),
  );

  return { token, isStale: () => token() !== undefined && now() - issuedAt() >= renewAfterMs };
}

type Renewal = {
  page: Page;
  session: ReturnType<typeof reatomSessionToken>;
  request: <Schema extends z.ZodType>(
    path: string,
    options: RequestOptions<Schema>,
  ) => Promise<z.infer<Schema>>;
};

function renewOnReturn({ page, session, request }: Renewal): void {
  const renew = action(async () => {
    const renewed = await wrap(
      request("/api/session/renew", { method: "POST", schema: sessionToken }),
    );

    session.token.set(renewed.token);
  }, "httpClient.renew");

  page.addEventListener("visibilitychange", () => {
    if (page.visibilityState === "visible" && session.isStale()) {
      // A renewal that fails on the network is tried again the next time the app comes back.
      renew().catch(noop);
    }
  });
}

export function createHttpClient(options: HttpClientOptions) {
  const { baseUrl, fetch, timeoutMs = defaultTimeoutMs, page, now = Date.now } = options;
  const session = reatomSessionToken(now);
  const isSessionLost = reatomBoolean(false, "httpClient.isSessionLost");

  async function request<Schema extends z.ZodType>(
    path: string,
    { schema, method = "GET", body }: RequestOptions<Schema>,
  ): Promise<z.infer<Schema>> {
    const response = await wrap(
      fetchUntilAborted(fetch, {
        url: new URL(path, baseUrl),
        init: {
          method,
          headers: headersFor(body, session.token()),
          body: body === undefined || isRaw(body) ? body : JSON.stringify(body),
        },
        timeoutMs,
      }),
    );

    if (response.status === unauthorizedStatus) {
      isSessionLost.setTrue();
    }

    if (!response.ok) {
      throw new HttpError(
        response.status,
        await wrap(errorCodeOf(response)),
        retryAfterOf(response),
      );
    }

    return schema.parse(await wrap(response.json()));
  }

  if (page !== undefined) {
    renewOnReturn({ page, session, request });
  }

  // The Worker hands out its own paths, such as signed photo links; the browser needs them whole.
  function url(path: string): string {
    return new URL(path, baseUrl).toString();
  }

  return { request, url, token: session.token, isSessionLost };
}

export type HttpClient = ReturnType<typeof createHttpClient>;
