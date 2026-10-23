import { plan, today } from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";

export type PlanStep = { planId: string; subplanId: string | null };

function stepPath({ planId, subplanId }: PlanStep): string {
  return subplanId === null ? `/api/plans/${planId}` : `/api/plans/${planId}/subplans/${subplanId}`;
}

export function createTodayApi(client: HttpClient) {
  return {
    load: async () => client.request("/api/today", { schema: today }),
    complete: async (step: PlanStep) =>
      client.request(`${stepPath(step)}/complete`, { method: "POST", schema: plan }),
    reopen: async (step: PlanStep) =>
      client.request(`${stepPath(step)}/reopen`, { method: "POST", schema: plan }),
  };
}

export type TodayApi = ReturnType<typeof createTodayApi>;
