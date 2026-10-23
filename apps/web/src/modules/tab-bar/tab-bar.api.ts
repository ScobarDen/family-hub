import { wrap } from "@reatom/core";

import { tabBarSettings, type SlotModule } from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";

export function createTabBarApi(client: HttpClient) {
  return {
    async save(modules: SlotModule[]): Promise<SlotModule[]> {
      const saved = await wrap(
        client.request("/api/me/tab-bar", {
          method: "PUT",
          body: { modules },
          schema: tabBarSettings,
        }),
      );

      return saved.modules;
    },
  };
}

export type TabBarApi = ReturnType<typeof createTabBarApi>;
