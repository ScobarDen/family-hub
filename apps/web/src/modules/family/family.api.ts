import {
  deleted,
  familyLeft,
  familyMemberList,
  familyOwnerChanged,
  memberRemoved,
  type FamilyDeletion,
  type FamilyOwnerChange,
} from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client.api.ts";

export function createFamilyApi(client: HttpClient) {
  return {
    members: async () => client.request("/api/family/members", { schema: familyMemberList }),

    leave: async () => client.request("/api/family/leave", { method: "POST", schema: familyLeft }),

    remove: async (memberId: string) =>
      client.request(`/api/family/members/${memberId}`, {
        method: "DELETE",
        schema: memberRemoved,
      }),

    handOver: async (memberId: string) =>
      client.request("/api/family/owner", {
        method: "PUT",
        body: { memberId } satisfies FamilyOwnerChange,
        schema: familyOwnerChanged,
      }),

    deleteFamily: async (familyName: string) =>
      client.request("/api/family", {
        method: "DELETE",
        body: { familyName } satisfies FamilyDeletion,
        schema: deleted,
      }),
  };
}

export type FamilyApi = ReturnType<typeof createFamilyApi>;
