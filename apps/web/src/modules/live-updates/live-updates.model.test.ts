import { atom, context } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { LiveMessage } from "@family-hub/contract";

import { reatomLiveUpdates, type LiveSocket } from "./live-updates.model.ts";

class FakeSocket extends EventTarget implements LiveSocket {
  isClosed = false;

  close(): void {
    this.isClosed = true;
    // A browser fires «close» later, never inside close().
    queueMicrotask(() => {
      this.dispatchEvent(new Event("close"));
    });
  }

  connect(versions: LiveMessage["versions"] = {}): void {
    this.dispatchEvent(new Event("open"));
    this.receive({ versions });
  }

  receive(message: LiveMessage | string): void {
    const data = typeof message === "string" ? message : JSON.stringify(message);

    this.dispatchEvent(new MessageEvent("message", { data }));
  }
}

class FakePage extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";

  show(state: DocumentVisibilityState): void {
    this.visibilityState = state;
    this.dispatchEvent(new Event("visibilitychange"));
  }
}

const ownClientId = "6b1d3c1e-8a52-4f7e-9b0e-2f4c5d6e7a81";
const otherClientId = "0f8f2a52-3c4e-4b8a-9d55-6a1f0e2b7c11";

function startLive({ token = atom<string | undefined>("token") } = {}) {
  const sockets: FakeSocket[] = [];

  function opened(socket: FakeSocket): FakeSocket {
    sockets.push(socket);

    return socket;
  }

  const page = new FakePage();
  const live = reatomLiveUpdates({
    open: () => (token() === undefined ? undefined : opened(new FakeSocket())),
    page,
    wait: async () => Promise.resolve(),
    clientId: ownClientId,
  });

  live.start();

  return { live, sockets, page, token };
}

async function settled(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

beforeEach(() => {
  context.reset();
});

describe("live updates", () => {
  test("the first connection only learns the versions, since the launch has just loaded", async () => {
    const { live, sockets } = startLive();

    sockets[0]?.connect({ tasks: 4, goals: 2 });
    await settled();

    expect(live.all()).toBe(0);
    expect(live.isConnected()).toBe(true);
  });

  test("another Member's change bumps each module it names once per burst", async () => {
    const { live, sockets } = startLive();
    const [socket] = sockets;

    socket?.connect({ tasks: 4 });
    socket?.receive({ versions: { tasks: 5, pet: 1 }, writer: otherClientId });
    socket?.receive({ versions: { tasks: 6, pet: 2 } });
    socket?.receive("tasks");

    await vi.waitFor(() => {
      expect(live.versionOf("tasks")).toBe(1);
    });
    expect(live.versionOf("pet")).toBe(1);
    expect(live.versionOf("goals")).toBe(0);
  });

  test("one signal for several modules refetches what reads them all once", async () => {
    const { live, sockets } = startLive();
    const seen: number[] = [];

    live.all.subscribe((all) => {
      seen.push(all);
    });
    sockets[0]?.connect();
    sockets[0]?.receive({ versions: { tasks: 1, pet: 1 } });

    await vi.waitFor(() => {
      expect(seen).toEqual([0, 2]);
    });
  });

  test("this app's own write refetches its modules once, without its echo", async () => {
    const { live, sockets } = startLive();

    sockets[0]?.connect({ albums: 3 });
    live.wrote("/api/albums/album-1?with=photos");

    await vi.waitFor(() => {
      expect(live.versionOf("albums")).toBe(1);
    });
    sockets[0]?.receive({ versions: { albums: 4 }, writer: ownClientId });
    await settled();
    expect(live.all()).toBe(1);
  });

  test("a reconnection refetches only the modules that moved meanwhile", async () => {
    const { live, sockets, page } = startLive();

    sockets[0]?.connect({ tasks: 4, goals: 2 });
    page.show("hidden");
    await vi.waitFor(() => {
      expect(live.isConnected()).toBe(false);
    });
    page.show("visible");
    await vi.waitFor(() => {
      expect(sockets).toHaveLength(2);
    });
    sockets[1]?.connect({ tasks: 4, goals: 3, recipes: 1 });

    await vi.waitFor(() => {
      expect(live.versionOf("goals")).toBe(1);
    });
    expect(live.versionOf("recipes")).toBe(1);
    expect(live.versionOf("tasks")).toBe(0);
  });

  test("a hidden app holds no socket and reconnects when it comes back", async () => {
    const { sockets, page } = startLive();

    page.show("hidden");

    await vi.waitFor(() => {
      expect(sockets[0]?.isClosed).toBe(true);
    });
    expect(sockets).toHaveLength(1);

    page.show("visible");

    await vi.waitFor(() => {
      expect(sockets).toHaveLength(2);
    });
  });

  test("a dropped socket is opened again", async () => {
    const { sockets } = startLive();

    sockets[0]?.dispatchEvent(new Event("close"));

    await vi.waitFor(() => {
      expect(sockets).toHaveLength(2);
    });
  });

  test("the socket waits for the session", async () => {
    const token = atom<string | undefined>();
    const { sockets } = startLive({ token });

    expect(sockets).toHaveLength(0);

    token.set("token");

    await vi.waitFor(() => {
      expect(sockets).toHaveLength(1);
    });
  });
});
