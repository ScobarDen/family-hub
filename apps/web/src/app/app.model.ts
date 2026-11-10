import { liveClientHeader } from "@family-hub/contract";

import { createHttpClient, type HttpClient } from "@/common/http-client.api.ts";
import type { BrowserPlatform } from "@/modules/browser-platform";
import type { Slide } from "@/modules/changes";
import { reatomDeviceCache } from "@/modules/device-cache";
import { type LivePage, type LiveSocket, reatomLiveUpdates } from "@/modules/live-updates";
import { createSessionApi } from "@/modules/session";
import type { Telegram } from "@/modules/telegram";

export type AppDependencies = {
  telegram: Telegram;
  // Only the Installed App has one: outside Telegram the browser serves the platform features.
  platform: BrowserPlatform | undefined;
  apiUrl: string;
  fetch: Parameters<typeof createHttpClient>[0]["fetch"];
  page: LivePage;
  storage: Parameters<typeof createSessionApi>[1];
  liveClientId: string;
  openSocket: (client: HttpClient) => LiveSocket | undefined;
  wait: (ms: number) => Promise<void>;
  slide: Slide;
  base: string;
  botUsername: string | undefined;
  installUrl: string;
  deviceZone: () => string;
  zones: string[];
};

export function reatomTransport(dependencies: AppDependencies) {
  const { telegram, platform, liveClientId } = dependencies;
  const httpClient = createHttpClient({
    baseUrl: dependencies.apiUrl,
    fetch: dependencies.fetch,
    page: dependencies.page,
    holdUntilSignedIn: true,
    reauthenticate: platform && (async () => sessionApi.reauthenticate()),
    writeHeaders: { [liveClientHeader]: liveClientId },
    onWrite: (path) => {
      live.wrote(path);
    },
  });
  const sessionApi = createSessionApi(httpClient, dependencies.storage);
  const live = reatomLiveUpdates({
    open: () => dependencies.openSocket(httpClient),
    page: dependencies.page,
    wait: dependencies.wait,
    clientId: liveClientId,
  });

  return { httpClient, sessionApi, live, deviceCache: reatomDeviceCache(telegram.deviceStorage) };
}

export type AppTransport = ReturnType<typeof reatomTransport>;
