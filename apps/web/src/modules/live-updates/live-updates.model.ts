import {
  abortVar,
  atom,
  type Atom,
  computed,
  effect,
  noop,
  onEvent,
  withConnectHook,
  wrap,
} from "@reatom/core";

import {
  appModule,
  liveMessage,
  modulesOfPath,
  type AppModule,
  type LiveMessage,
} from "@family-hub/contract";

export type LiveSocket = EventTarget & { close(): void };

export type LivePage = EventTarget & { readonly visibilityState: DocumentVisibilityState };

export type LiveUpdatesDependencies = {
  // Undefined while there is no session to open the socket with.
  open: () => LiveSocket | undefined;
  page: LivePage;
  wait: (ms: number) => Promise<void>;
  // Sent with this app's writes, so their echo through the socket is recognised.
  clientId: string;
};

export type LiveVersion = { liveVersion: () => number };

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

function parsed(data: unknown): LiveMessage | undefined {
  try {
    return liveMessage.safeParse(JSON.parse(String(data))).data;
  } catch {
    return undefined;
  }
}

// A burst of signals, for one module or several, refetches each of them once and together.
function reatomVersions(wait: LiveUpdatesDependencies["wait"]) {
  const versions = new Map(
    appModule.options.map((module) => [module, atom(0, `liveUpdates.${module}`)]),
  );
  const pending = new Set<AppModule>();

  const bumpPending = wrap(() => {
    const modules = [...pending];

    pending.clear();

    for (const module of modules) {
      versions.get(module)?.set((version) => version + 1);
    }
  });

  return {
    versionOf: (module: AppModule) => versions.get(module)?.() ?? 0,
    changed: (modules: AppModule[]) => {
      const isWindowOpen = pending.size > 0;

      for (const module of modules) {
        pending.add(module);
      }

      if (!isWindowOpen && pending.size > 0) {
        wait(coalesceMs).then(bumpPending).catch(noop);
      }
    },
  };
}

type Versions = ReturnType<typeof reatomVersions>;

// What the Family's Object last told this app; the first connection only learns it, since the
// launch has just loaded every screen, and a reconnection refetches only the modules that moved.
function reatomServerVersions({ versions, clientId }: { versions: Versions; clientId: string }) {
  const known = new Map<AppModule, number>();
  let isKnown = false;

  return (message: LiveMessage): void => {
    const isOwnEcho = message.writer === clientId;
    const moved: AppModule[] = [];

    for (const module of appModule.options) {
      const version = message.versions[module];

      if (version !== undefined && version !== (known.get(module) ?? 0)) {
        moved.push(module);
        known.set(module, version);
      }
    }

    if (isKnown && !isOwnEcho) {
      versions.changed(moved);
    }

    isKnown = true;
  };
}

type Listener = {
  received: (message: LiveMessage) => void;
  onOpen: () => void;
};

function listen(socket: LiveSocket, { received, onOpen }: Listener) {
  onEvent(socket, "open", onOpen);
  onEvent(socket, "message", (event: MessageEvent) => {
    const message = parsed(event.data);

    if (message !== undefined) {
      received(message);
    }
  });
}

// Only an app on screen holds a socket; hiding it aborts the loop and closes the socket.
async function keepConnected(
  { open, wait }: Pick<LiveUpdatesDependencies, "open" | "wait">,
  { received, isConnected }: { received: Listener["received"]; isConnected: Atom<boolean> },
): Promise<void> {
  const { controller, unsubscribe } = abortVar.subscribe();
  let attempt = 0;

  try {
    for (let socket = open(); socket !== undefined; socket = open()) {
      const current = socket;

      controller.signal.addEventListener("abort", () => current.close(), { once: true });
      listen(current, {
        received,
        onOpen: () => {
          attempt = 0;
          isConnected.set(true);
        },
      });
      await wrap(onEvent(current, "close"));
      isConnected.set(false);
      await wrap(wait(backoffOf(attempt)));
      attempt += 1;
    }
  } finally {
    isConnected.set(false);
    unsubscribe();
  }
}

export function reatomLiveUpdates({ page, clientId, ...dependencies }: LiveUpdatesDependencies) {
  const isVisible = reatomIsVisible(page);
  const isConnected = atom(false, "liveUpdates.isConnected");
  const versions = reatomVersions(dependencies.wait);
  const received = reatomServerVersions({ versions, clientId });

  return {
    versionOf: versions.versionOf,
    all: computed(() => {
      let sum = 0;

      for (const module of appModule.options) {
        sum += versions.versionOf(module);
      }

      return sum;
    }, "liveUpdates.all"),
    // While connected, every change of the Family, this app's own included, reaches the versions.
    isConnected: () => isConnected(),
    // This app's own write refetches without waiting for the socket, which then skips its echo.
    wrote: (path: string) => {
      versions.changed(modulesOfPath(path));
    },
    start: () =>
      effect(async () => {
        if (isVisible()) {
          await keepConnected(dependencies, { received, isConnected });
        }
      }, "liveUpdates.start"),
  };
}

export type LiveUpdates = ReturnType<typeof reatomLiveUpdates>;
