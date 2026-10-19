import { familyMemberList } from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";

export function createFamilyApi(client: HttpClient) {
  return {
    members: async () => client.request("/api/family/members", { schema: familyMemberList }),
  };
}

export type FamilyApi = ReturnType<typeof createFamilyApi>;
