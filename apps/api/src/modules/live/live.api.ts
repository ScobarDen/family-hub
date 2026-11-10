import { liveProtocol, type AppModule, type LiveMessage } from "@family-hub/contract";

import type { Membership } from "@/modules/auth";

const switchingProtocols = 101;
const noContent = 204;
const signalUrl = "https://live/signal";
const versionsKey = "versions";

type Versions = LiveMessage["versions"];

export type LiveSignal = { modules: AppModule[]; writer?: string };

// One per Family: it holds every open app's hibernating socket and relays which module changed.
// A version per module, kept in storage, lets a reconnecting app refetch only what moved meanwhile.
export class FamilyLive implements DurableObject {
  readonly #state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.#state = state;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("upgrade") === "websocket") {
      return this.#accept();
    }

    const { modules, writer } = await request.json<LiveSignal>();
    const message = JSON.stringify({ versions: await this.#bump(modules), writer });

    for (const socket of this.#state.getWebSockets()) {
      this.#send(socket, message);
    }

    return new Response(null, { status: noContent });
  }

  async #versions(): Promise<Versions> {
    return (await this.#state.storage.get<Versions>(versionsKey)) ?? {};
  }

  async #bump(modules: AppModule[]): Promise<Versions> {
    const versions = await this.#versions();
    const moved: Versions = {};

    for (const module of new Set(modules)) {
      moved[module] = (versions[module] ?? 0) + 1;
    }

    await this.#state.storage.put(versionsKey, { ...versions, ...moved });

    return moved;
  }

  async #accept(): Promise<Response> {
    const { 0: client, 1: server } = new WebSocketPair();

    this.#state.acceptWebSocket(server);
    this.#send(server, JSON.stringify({ versions: await this.#versions() }));

    return new Response(null, {
      status: switchingProtocols,
      webSocket: client,
      headers: { "sec-websocket-protocol": liveProtocol },
    });
  }

  // A socket closing mid-send drops its signal; the app compares versions when it reconnects.
  #send(socket: WebSocket, message: string): void {
    try {
      socket.send(message);
    } catch {
      socket.close();
    }
  }
}

async function signalFamily(
  live: Env["LIVE"],
  { familyId, ...signal }: LiveSignal & { familyId: string },
): Promise<void> {
  await live.getByName(familyId).fetch(signalUrl, { method: "POST", body: JSON.stringify(signal) });
}

export type LiveChanges = {
  changed(familyId: string, modules: AppModule[]): void;
};

type Command = (membership: Membership, ...rest: never[]) => Promise<object>;

// A command wrote when it returned its record or said so; a refusal carries any other status.
function isWritten(result: object): boolean {
  return !("status" in result) || result.status === "ok" || result.status === "deleted";
}

export function reportingChanges<Commands extends Record<string, Command>>(
  live: LiveChanges,
  { modules, commands }: { modules: AppModule[]; commands: Commands },
): Commands {
  const reporting = Object.fromEntries(
    Object.entries(commands).map(([name, command]) => [
      name,
      async (membership: Membership, ...rest: never[]) => {
        const result = await command(membership, ...rest);

        if (isWritten(result)) {
          live.changed(membership.family.id, modules);
        }

        return result;
      },
    ]),
  );

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Object.fromEntries drops the names and signatures it keeps
  return reporting as Commands;
}

export function createLiveChanges(live: Env["LIVE"], { writer }: { writer?: string } = {}) {
  const changedByFamily = new Map<string, Set<AppModule>>();

  return {
    changed: (familyId: string, modules: AppModule[]) => {
      const changed = changedByFamily.get(familyId) ?? new Set();

      for (const module of modules) {
        changed.add(module);
      }

      changedByFamily.set(familyId, changed);
    },
    flush: async () => {
      const signals = [...changedByFamily];

      changedByFamily.clear();
      await Promise.all(
        signals.map(async ([familyId, modules]) =>
          signalFamily(live, { familyId, modules: [...modules], writer }),
        ),
      );
    },
  } satisfies LiveChanges & { flush(): Promise<void> };
}
