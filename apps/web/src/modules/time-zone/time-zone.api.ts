import { timeZoneSettings, type TimeZoneSettings } from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";

export function createTimeZoneApi(client: HttpClient) {
  return {
    save: async (settings: TimeZoneSettings) =>
      client.request("/api/me/time-zone", {
        method: "PUT",
        body: settings,
        schema: timeZoneSettings,
      }),
  };
}

export type TimeZoneApi = ReturnType<typeof createTimeZoneApi>;
