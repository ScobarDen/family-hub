import { wrap } from "@reatom/core";

import { inviteCreated, inviteList, inviteRevoked } from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client.api.ts";
import { HttpError } from "@/common/http-error.lib.ts";

export function createInvitesApi(client: HttpClient) {
  return {
    list: async () => client.request("/api/invites", { schema: inviteList }),

    create: async () => client.request("/api/invites", { method: "POST", schema: inviteCreated }),

    // An Invite that was used or expired meanwhile is gone either way.
    async revoke(inviteId: string): Promise<void> {
      try {
        await wrap(
          client.request(`/api/invites/${inviteId}`, { method: "DELETE", schema: inviteRevoked }),
        );
      } catch (error) {
        if (!(error instanceof HttpError && error.code === "INVITE_NOT_FOUND")) {
          throw error;
        }
      }
    },
  };
}

export type InvitesApi = ReturnType<typeof createInvitesApi>;
