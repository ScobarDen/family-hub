import { livePath, liveProtocol } from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";

import type { LiveSocket } from "./live-updates.model.ts";

export function openLiveSocket(client: Pick<HttpClient, "url" | "token">): LiveSocket | undefined {
  const token = client.token();

  return token === undefined
    ? undefined
    : new WebSocket(client.url(livePath).replace(/^http/u, "ws"), [liveProtocol, token]);
}
