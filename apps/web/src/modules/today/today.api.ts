import { plan, today } from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";

export type PlanOrSubplan = { planId: string; subplanId: string | null };

function completionPath({ planId, subplanId }: PlanOrSubplan): string {
  return subplanId === null
    ? `/api/plans/${planId}/complete`
    : `/api/plans/${planId}/subplans/${subplanId}/complete`;
}

export function createTodayApi(client: HttpClient) {
  return {
    load: async () => client.request("/api/today", { schema: today }),
    complete: async (target: PlanOrSubplan) =>
      client.request(completionPath(target), { method: "POST", schema: plan }),
  };
}

export type TodayApi = ReturnType<typeof createTodayApi>;
