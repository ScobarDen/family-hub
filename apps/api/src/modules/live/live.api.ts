import { liveProtocol, type AppModule } from "@family-hub/contract";

const switchingProtocols = 101;
const noContent = 204;
const signalUrl = "https://live/signal";

// One per Family: it holds every open app's hibernating socket and relays which module changed.
export class FamilyLive implements DurableObject {
  readonly #state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.#state = state;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("upgrade") === "websocket") {
      return this.#accept();
    }

    const modules = await request.json<AppModule[]>();

    for (const socket of this.#state.getWebSockets()) {
      this.#send(socket, modules);
    }

    return new Response(null, { status: noContent });
  }

  #accept(): Response {
    const { 0: client, 1: server } = new WebSocketPair();

    this.#state.acceptWebSocket(server);

    return new Response(null, {
      status: switchingProtocols,
      webSocket: client,
      headers: { "sec-websocket-protocol": liveProtocol },
    });
  }

  // A socket closing mid-send drops its signal; the app refetches when it reconnects.
  #send(socket: WebSocket, modules: AppModule[]): void {
    try {
      for (const module of modules) {
        socket.send(module);
      }
    } catch {
      socket.close();
    }
  }
}

export async function signalFamily(
  live: Env["LIVE"],
  { familyId, modules }: { familyId: string; modules: AppModule[] },
): Promise<void> {
  if (modules.length === 0) {
    return;
  }

  await live
    .getByName(familyId)
    .fetch(signalUrl, { method: "POST", body: JSON.stringify(modules) });
}
