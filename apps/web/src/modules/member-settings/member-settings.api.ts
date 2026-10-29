import {
  digestSettings,
  timeZoneSettings,
  type DigestSettings,
  type TimeZoneSettings,
} from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client.api.ts";

export function createMemberSettingsApi(client: HttpClient) {
  return {
    saveDigest: async (settings: DigestSettings) =>
      client.request("/api/me/digest", { method: "PUT", body: settings, schema: digestSettings }),
    saveTimeZone: async (settings: TimeZoneSettings) =>
      client.request("/api/me/time-zone", {
        method: "PUT",
        body: settings,
        schema: timeZoneSettings,
      }),
  };
}

export type MemberSettingsApi = ReturnType<typeof createMemberSettingsApi>;
