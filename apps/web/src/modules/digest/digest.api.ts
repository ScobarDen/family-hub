import { digestSettings, type DigestSettings } from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";

export function createDigestApi(client: HttpClient) {
  return {
    save: async (settings: DigestSettings) =>
      client.request("/api/me/digest", { method: "PUT", body: settings, schema: digestSettings }),
  };
}

export type DigestApi = ReturnType<typeof createDigestApi>;
