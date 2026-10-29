import { atom, context } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

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

  receive(data: string): void {
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
  });

  live.start();

  return { live, sockets, page, token };
}

beforeEach(() => {
  context.reset();
});

describe("live updates", () => {
  test("a module's signal bumps that module's version once per burst", async () => {
    const { live, sockets } = startLive();
    const [socket] = sockets;

    socket?.receive("tasks");
    socket?.receive("tasks");
    socket?.receive("nonsense");

    await vi.waitFor(() => {
      expect(live.versionOf("tasks")).toBe(1);
    });
    expect(live.versionOf("goals")).toBe(0);
  });

  test("every module refetches when the socket opens", async () => {
    const { live, sockets } = startLive();

    sockets[0]?.dispatchEvent(new Event("open"));

    await vi.waitFor(() => {
      expect(live.versionOf("goals")).toBe(1);
    });
    expect(live.all()).toBe(6);
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
