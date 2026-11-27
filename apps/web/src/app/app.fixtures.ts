import { noop, atom } from "@reatom/core";

import type { LiveMessage } from "@family-hub/contract";

import { instantly } from "@/modules/changes";
import { FakePage, FakeSocket } from "@/modules/live-updates";
import { memoryStorage } from "@/modules/session";
import { fakeDeviceStorage, fakeWebApp, reatomTelegram } from "@/modules/telegram";

import type { AppDependencies } from "./app.model.ts";
import { fakeWorker, type Routes } from "./fake-worker.fixtures.ts";
import { reatomApp } from "./vm/app.vm.ts";

const otherClientId = "0f8f2a52-3c4e-4b8a-9d55-6a1f0e2b7c11";

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

async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// The button id that `isConfirmed` in `modules/telegram` takes for a yes.
const confirmButton = "confirm";

type Popups = "unanswered" | "confirmed";

function telegramAnswering(popups: Popups, startParameter: string | undefined) {
  const launched = fakeWebApp({
    initData: "query_id=AAH&hash=abc",
    deviceStorage: fakeDeviceStorage().deviceStorage,
  });
  const webApp = { ...launched.webApp, initDataUnsafe: { start_param: startParameter } };

  if (popups === "unanswered") {
    return reatomTelegram(webApp);
  }

  return reatomTelegram({
    ...webApp,
    showPopup: (params, callback) => {
      callback?.(params.buttons.find(({ id }) => id === confirmButton)?.id ?? null);
    },
  });
}

const fixedDependencies = {
  platform: undefined,
  apiUrl: "https://api.family-hub.test",
  wait,
  slide: instantly,
  base: "/family-hub/",
  botUsername: undefined,
  installUrl: "https://scobarden.github.io/family-hub/install.html",
  deviceZone: () => "Europe/Moscow",
  zones: ["Europe/Moscow"],
} satisfies Partial<AppDependencies>;

type Home = ReturnType<typeof reatomApp>["home"];

// A module's screen loads only while something reads it; in the app that is the shown module's view.
function readShownScreen(home: Home): void {
  const screens = {
    tasks: home.tasks.screen,
    pet: home.pet.pets.screen,
    goals: home.goals.screen,
    albums: home.albums.screen,
    recipes: home.recipes.screen,
  };
  let stopReading = noop;

  home.navigation.shownModule.subscribe((module) => {
    stopReading();
    stopReading =
      module === undefined || module === "feed" ? noop : screens[module].subscribe(noop);
  });
}

// The whole app over a fake Worker and a fake socket, as a Member in Telegram sees it.
export function startApp(
  routes: Routes,
  {
    popups = "unanswered",
    startParameter,
    isWide = false,
  }: { popups?: Popups; startParameter?: string; isWide?: boolean } = {},
) {
  const wide = atom(isWide, "fakeIsWide");
  const worker = fakeWorker(routes);
  const sockets = fakeSockets();
  const app = reatomApp({
    ...fixedDependencies,
    telegram: telegramAnswering(popups, startParameter),
    fetch: worker.fetch,
    page: new FakePage(),
    storage: memoryStorage(),
    liveClientId: crypto.randomUUID(),
    openSocket: sockets.open,
    isWide: wide,
  });

  app.launch();
  app.home.session.screen.subscribe(noop);
  readShownScreen(app.home);

  return {
    app,
    // Another Member's write reaches this app through the socket as moved versions.
    otherMemberChanged: (versions: LiveMessage["versions"]) => {
      sockets.latest()?.receive({ versions, writer: otherClientId });
    },
    connect: (versions: LiveMessage["versions"] = {}) => {
      sockets.latest()?.connect(versions);
    },
    setWide: (isWideNow: boolean) => {
      wide.set(isWideNow);
    },
    countOf: (request: string) => worker.requests.filter((sent) => sent === request).length,
  };
}
