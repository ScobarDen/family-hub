import {
  abortVar,
  atom,
  computed,
  effect,
  noop,
  onEvent,
  withConnectHook,
  wrap,
} from "@reatom/core";

import { appModule, type AppModule } from "@family-hub/contract";

export type LiveSocket = EventTarget & { close(): void };

export type LivePage = EventTarget & { readonly visibilityState: DocumentVisibilityState };

export type LiveUpdatesDependencies = {
  // Undefined while there is no session to open the socket with.
  open: () => LiveSocket | undefined;
  page: LivePage;
  wait: (ms: number) => Promise<void>;
};

export type LiveVersion = { liveVersion?: () => number };

const coalesceMs = 300;
const firstBackoffMs = 1000;
const maxBackoffMs = 30_000;
const backoffFactor = 2;

function backoffOf(attempt: number): number {
  return Math.min(firstBackoffMs * backoffFactor ** attempt, maxBackoffMs);
}

function reatomIsVisible(page: LivePage) {
  return atom(page.visibilityState === "visible", "liveUpdates.isVisible").extend(
    withConnectHook((target) => {
      const sync = wrap(() => {
        target.set(page.visibilityState === "visible");
      });

      page.addEventListener("visibilitychange", sync);
      // The hook connects after the first read, so a change in between would be missed.
      sync();

      return () => {
        page.removeEventListener("visibilitychange", sync);
      };
    }),
  );
}

function reatomVersions(wait: LiveUpdatesDependencies["wait"]) {
  const versions = new Map(
    appModule.options.map((module) => [module, atom(0, `liveUpdates.${module}`)]),
  );

  function bump(module: AppModule): void {
    versions.get(module)?.set((version) => version + 1);
  }

  // A burst of signals for one module refetches it once.
  const pending = new Set<AppModule>();

  return {
    versionOf: (module: AppModule) => versions.get(module)?.() ?? 0,
    changed: (module: AppModule) => {
      if (pending.has(module)) {
        return;
      }

      pending.add(module);
      wait(coalesceMs)
        .then(
          wrap(() => {
            pending.delete(module);
            bump(module);
          }),
        )
        .catch(noop);
    },
    // A reconnect may have missed signals, so every open screen refetches.
    bumpAll: () => {
      for (const module of appModule.options) {
        bump(module);
      }
    },
  };
}

type Versions = ReturnType<typeof reatomVersions>;

function listen(
  socket: LiveSocket,
  { versions, onOpen }: { versions: Versions; onOpen: () => void },
) {
  onEvent(socket, "open", () => {
    onOpen();
    versions.bumpAll();
  });
  onEvent(socket, "message", (event: MessageEvent) => {
    const module = appModule.safeParse(event.data);

    if (module.success) {
      versions.changed(module.data);
    }
  });
}

// Only an app on screen holds a socket; hiding it aborts the loop and closes the socket.
async function keepConnected(
  { open, wait }: Omit<LiveUpdatesDependencies, "page">,
  versions: Versions,
): Promise<void> {
  const { controller, unsubscribe } = abortVar.subscribe();
  let attempt = 0;

  try {
    for (let socket = open(); socket !== undefined; socket = open()) {
      const current = socket;

      controller.signal.addEventListener("abort", () => current.close(), { once: true });
      listen(current, {
        versions,
        onOpen: () => {
          attempt = 0;
        },
      });
      await wrap(onEvent(current, "close"));
      await wrap(wait(backoffOf(attempt)));
      attempt += 1;
    }
  } finally {
    unsubscribe();
  }
}

export function reatomLiveUpdates({ page, ...dependencies }: LiveUpdatesDependencies) {
  const isVisible = reatomIsVisible(page);
  const versions = reatomVersions(dependencies.wait);

  return {
    versionOf: versions.versionOf,
    all: computed(() => {
      let sum = 0;

      for (const module of appModule.options) {
        sum += versions.versionOf(module);
      }

      return sum;
    }, "liveUpdates.all"),
    start: () =>
      effect(async () => {
        if (isVisible()) {
          await keepConnected(dependencies, versions);
        }
      }, "liveUpdates.start"),
  };
}

export type LiveUpdates = ReturnType<typeof reatomLiveUpdates>;
