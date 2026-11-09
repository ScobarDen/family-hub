import { liveClientId, liveProtocol } from "@family-hub/contract";

export function tokenOfProtocols(header: string | undefined): string | undefined {
  const protocols = (header ?? "").split(",").map((protocol) => protocol.trim());

  return protocols.includes(liveProtocol)
    ? protocols.find((protocol) => protocol !== liveProtocol && protocol !== "")
    : undefined;
}

// Relayed to every Member of the Family, so only a well-formed id goes through.
export function writerOf(header: string | undefined): string | undefined {
  return liveClientId.safeParse(header).data;
}
