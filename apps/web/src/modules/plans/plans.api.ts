import {
  familyMemberList,
  plan,
  planDeleted,
  planList,
  type PlanChange,
  type SubplanChange,
} from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";

export type SubplanTarget = { planId: string; subplanId: string };

export function createPlansApi(client: HttpClient) {
  async function post(path: string, body?: unknown) {
    return client.request(path, { method: "POST", body, schema: plan });
  }

  return {
    list: async () => client.request("/api/plans", { schema: planList }),
    members: async () => client.request("/api/family/members", { schema: familyMemberList }),

    create: async (change: PlanChange) => post("/api/plans", change),
    update: async (planId: string, change: PlanChange) =>
      client.request(`/api/plans/${planId}`, { method: "PUT", body: change, schema: plan }),
    remove: async (planId: string) =>
      client.request(`/api/plans/${planId}`, { method: "DELETE", schema: planDeleted }),
    complete: async (planId: string) => post(`/api/plans/${planId}/complete`),
    reopen: async (planId: string) => post(`/api/plans/${planId}/reopen`),

    addSubplan: async (planId: string, change: SubplanChange) =>
      post(`/api/plans/${planId}/subplans`, change),
    updateSubplan: async ({ planId, subplanId }: SubplanTarget, change: SubplanChange) =>
      client.request(`/api/plans/${planId}/subplans/${subplanId}`, {
        method: "PUT",
        body: change,
        schema: plan,
      }),
    removeSubplan: async ({ planId, subplanId }: SubplanTarget) =>
      client.request(`/api/plans/${planId}/subplans/${subplanId}`, {
        method: "DELETE",
        schema: plan,
      }),
    completeSubplan: async ({ planId, subplanId }: SubplanTarget) =>
      post(`/api/plans/${planId}/subplans/${subplanId}/complete`),
    reopenSubplan: async ({ planId, subplanId }: SubplanTarget) =>
      post(`/api/plans/${planId}/subplans/${subplanId}/reopen`),
  };
}

export type PlansApi = ReturnType<typeof createPlansApi>;
