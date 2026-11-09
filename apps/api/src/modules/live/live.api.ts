import { liveProtocol, type AppModule, type LiveMessage } from "@family-hub/contract";

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

export async function signalFamily(
  live: Env["LIVE"],
  { familyId, ...signal }: LiveSignal & { familyId: string },
): Promise<void> {
  if (signal.modules.length === 0) {
    return;
  }

  await live.getByName(familyId).fetch(signalUrl, { method: "POST", body: JSON.stringify(signal) });
}
