import { noop } from "@reatom/core";

import type { LiveMessage, SessionResponse } from "@family-hub/contract";

import { instantly } from "@/modules/changes";
import { FakePage, FakeSocket } from "@/modules/live-updates";
import { memoryStorage } from "@/modules/session";
import { fakeDeviceStorage, fakeWebApp, reatomTelegram } from "@/modules/telegram";

import { reatomApp } from "./app.vm.ts";

const token = "session-token";
const otherClientId = "0f8f2a52-3c4e-4b8a-9d55-6a1f0e2b7c11";

const signedIn: SessionResponse = {
  status: "member",
  token,
  member: { id: "member-1", name: "Денис" },
  family: { id: "family-1", name: "Гущины" },
  isFamilyOwner: true,
  settings: {
    tabBar: ["tasks", "goals"],
    timeZone: { timeZone: "Europe/Moscow", isAuto: true },
    canMessage: true,
    digest: { isEnabled: true, time: "09:00" },
    reminderChannel: "both",
  },
};

// What the Worker answers, by `METHOD /path`; the request body comes along for writes.
export type Routes = Record<string, (body: unknown) => unknown>;

function bodyOf(init: RequestInit | undefined): unknown {
  return typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
}

function fakeWorker(routes: Routes) {
  const requests: string[] = [];

  async function fetch(input: URL | string, init?: RequestInit): Promise<Response> {
    const request = `${init?.method ?? "GET"} ${new URL(String(input)).pathname}`;

    requests.push(request);

    if (request === "POST /api/session") {
      return Response.json(signedIn);
    }

    const route = routes[request];

    return route === undefined
      ? Response.json({ code: "NOT_FOUND", message: request }, { status: 404 })
      : Response.json(route(bodyOf(init)));
  }

  return { fetch, requests };
}

function fakeSockets() {
  const sockets: FakeSocket[] = [];

  return {
    open: (client: { token: () => string | undefined }): FakeSocket | undefined => {
      const socket = client.token() === undefined ? undefined : new FakeSocket();

      if (socket !== undefined) {
        sockets.push(socket);
      }

      return socket;
    },
    latest: () => sockets.at(-1),
  };
}

// The whole app over a fake Worker and a fake socket, as a Member in Telegram sees it.
export function startApp(routes: Routes) {
  const worker = fakeWorker(routes);
  const sockets = fakeSockets();
  const app = reatomApp({
    telegram: reatomTelegram(
      fakeWebApp({
        initData: "query_id=AAH&hash=abc",
        deviceStorage: fakeDeviceStorage().deviceStorage,
      }).webApp,
    ),
    platform: undefined,
    apiUrl: "https://api.family-hub.test",
    fetch: worker.fetch,
    page: new FakePage(),
    storage: memoryStorage(),
    liveClientId: crypto.randomUUID(),
    openSocket: sockets.open,
    wait: async () => Promise.resolve(),
    slide: instantly,
    base: "/family-hub/",
    botUsername: undefined,
    installUrl: "https://scobarden.github.io/family-hub/install.html",
    deviceZone: () => "Europe/Moscow",
    zones: ["Europe/Moscow"],
  });

  app.launch();
  app.home.session.screen.subscribe(noop);

  return {
    app,
    // Another Member's write reaches this app through the socket as moved versions.
    otherMemberChanged: (versions: LiveMessage["versions"]) => {
      sockets.latest()?.receive({ versions, writer: otherClientId });
    },
    connect: (versions: LiveMessage["versions"] = {}) => {
      sockets.latest()?.connect(versions);
    },
    countOf: (request: string) => worker.requests.filter((sent) => sent === request).length,
  };
}
