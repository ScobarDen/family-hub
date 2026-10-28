import { context } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { z } from "zod";

import type { SessionToken } from "@family-hub/contract";

import { createHttpClient } from "./http-client.api.ts";

const hourMs = 3_600_000;

class FakePage extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";

  show(state: DocumentVisibilityState): void {
    this.visibilityState = state;
    this.dispatchEvent(new Event("visibilitychange"));
  }
}

function startClient({
  renewal = Response.json({ token: "renewed" } satisfies SessionToken),
} = {}) {
  const page = new FakePage();
  const clock = { now: 0 };
  const requests: Array<{ path: string; authorization: string | null }> = [];

  async function fetch(url: URL, init: RequestInit): Promise<Response> {
    requests.push({
      path: url.pathname,
      authorization: new Headers(init.headers).get("authorization"),
    });

    return url.pathname === "/api/session/renew" ? renewal.clone() : Response.json({});
  }

  const client = createHttpClient({
    baseUrl: "https://api.family-hub.test",
    fetch,
    page,
    now: () => clock.now,
  });

  client.token.set("signed-in");

  return { client, page, clock, requests };
}

function renewals(requests: Array<{ path: string }>) {
  return requests.filter(({ path }) => path === "/api/session/renew");
}

beforeEach(() => {
  context.reset();
});

describe("renewing the session token when the app comes back on screen", () => {
  test("renews a token older than 12 hours and sends the fresh one afterwards", async () => {
    const { client, page, clock, requests } = startClient();

    clock.now = 12 * hourMs;
    page.show("hidden");
    page.show("visible");

    await vi.waitFor(() => {
      expect(client.token()).toBe("renewed");
    });
    await client.request("/api/today", { schema: z.unknown() });

    expect(renewals(requests)).toEqual([
      { path: "/api/session/renew", authorization: "Bearer signed-in" },
    ]);
    expect(requests.at(-1)).toEqual({ path: "/api/today", authorization: "Bearer renewed" });
  });

  test("keeps a token younger than 12 hours", async () => {
    const { client, page, clock, requests } = startClient();

    clock.now = 12 * hourMs - 1;
    page.show("hidden");
    page.show("visible");
    await client.request("/api/today", { schema: z.unknown() });

    expect(renewals(requests)).toEqual([]);
    expect(client.token()).toBe("signed-in");
  });

  test("counts the 12 hours from the last renewal", async () => {
    const { client, page, clock, requests } = startClient();

    clock.now = 13 * hourMs;
    page.show("visible");
    await vi.waitFor(() => {
      expect(client.token()).toBe("renewed");
    });
    clock.now = 24 * hourMs;
    page.show("visible");

    expect(renewals(requests)).toHaveLength(1);
  });

  test("asks to restart the app when the Worker refuses to renew", async () => {
    const { client, page, clock } = startClient({
      renewal: Response.json({ code: "UNAUTHENTICATED", message: "" }, { status: 401 }),
    });

    clock.now = 12 * hourMs;
    page.show("visible");

    await vi.waitFor(() => {
      expect(client.isSessionLost()).toBe(true);
    });
  });
});

function startHeldClient() {
  const requests: Array<{ path: string; authorization: string | null }> = [];
  const client = createHttpClient({
    baseUrl: "https://api.family-hub.test",
    fetch: async (url, init) => {
      requests.push({
        path: url.pathname,
        authorization: new Headers(init.headers).get("authorization"),
      });

      return Response.json({});
    },
    holdUntilSignedIn: true,
  });

  return { client, requests };
}

describe("a request made before sign-in", () => {
  test("waits for the session token instead of losing the session", async () => {
    const { client, requests } = startHeldClient();
    const loaded = client.request("/api/today", { schema: z.unknown() });

    await Promise.resolve();
    expect(requests).toEqual([]);
    client.token.set("signed-in");
    await loaded;

    expect(requests).toEqual([{ path: "/api/today", authorization: "Bearer signed-in" }]);
    expect(client.isSessionLost()).toBe(false);
  });

  test("goes at once when it signs in with initData itself", async () => {
    const { client, requests } = startHeldClient();

    await client.request("/api/session", {
      method: "POST",
      schema: z.unknown(),
      withoutSession: true,
    });

    expect(requests).toEqual([{ path: "/api/session", authorization: null }]);
  });
});
