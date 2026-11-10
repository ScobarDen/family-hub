import type { LiveMessage } from "@family-hub/contract";

import type { LiveSocket } from "./live-updates.model.ts";

export class FakeSocket extends EventTarget implements LiveSocket {
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

export class FakePage extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";

  show(state: DocumentVisibilityState): void {
    this.visibilityState = state;
    this.dispatchEvent(new Event("visibilitychange"));
  }
}
