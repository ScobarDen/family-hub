import { feedPage, plan } from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";

export type PlanStep = { planId: string; subplanId: string | null };

export function createFeedApi(client: HttpClient) {
  return {
    page: async (before?: string) =>
      client.request(
        before === undefined ? "/api/feed" : `/api/feed?before=${encodeURIComponent(before)}`,
        { schema: feedPage },
      ),
    complete: async ({ planId, subplanId }: PlanStep) =>
      client.request(
        subplanId === null
          ? `/api/plans/${planId}/complete`
          : `/api/plans/${planId}/subplans/${subplanId}/complete`,
        { method: "POST", schema: plan },
      ),
  };
}

export type FeedApi = ReturnType<typeof createFeedApi>;
