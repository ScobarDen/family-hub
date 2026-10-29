import { liveProtocol, type AppModule } from "@family-hub/contract";

import { modulesByPath } from "./live.config.ts";

export function modulesOfPath(path: string): AppModule[] {
  return modulesByPath.get(path.split("/")[2] ?? "") ?? [];
}

export function tokenOfProtocols(header: string | undefined): string | undefined {
  const protocols = (header ?? "").split(",").map((protocol) => protocol.trim());

  return protocols.includes(liveProtocol)
    ? protocols.find((protocol) => protocol !== liveProtocol && protocol !== "")
    : undefined;
}
