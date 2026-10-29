import {
  deleted,
  deviceList,
  digestSettings,
  pushKey,
  pushSubscription,
  reminderChannelSettings,
  timeZoneSettings,
  type DigestSettings,
  type PushSubscriptionChange,
  type ReminderChannel,
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
    async saveReminderChannel(channel: ReminderChannel): Promise<ReminderChannel> {
      const saved = await client.request("/api/me/reminder-channel", {
        method: "PUT",
        body: { channel },
        schema: reminderChannelSettings,
      });

      return saved.channel;
    },
    listDevices: async () => client.request("/api/devices", { schema: deviceList }),
    revokeDevice: async (deviceId: string) =>
      client.request(`/api/devices/${encodeURIComponent(deviceId)}`, {
        method: "DELETE",
        schema: deleted,
      }),
    pushKey: async () => client.request("/api/push/key", { schema: pushKey }),
    savePush: async (deviceId: string, subscription: PushSubscriptionChange) =>
      client.request(`/api/devices/${encodeURIComponent(deviceId)}/push`, {
        method: "PUT",
        body: subscription,
        schema: pushSubscription,
      }),
    deletePush: async (deviceId: string) =>
      client.request(`/api/devices/${encodeURIComponent(deviceId)}/push`, {
        method: "DELETE",
        schema: deleted,
      }),
  };
}

export type MemberSettingsApi = ReturnType<typeof createMemberSettingsApi>;
