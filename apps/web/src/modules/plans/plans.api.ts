import {
  albumList,
  plan,
  planDeleted,
  planList,
  type Plan,
  type PlanChange,
  type SubplanChange,
} from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";
import { resolvedPhoto } from "@/common/photo";

// The Album strip shows the Worker's signed paths; the browser loads them from its origin.
function resolvedPlan(client: HttpClient, saved: Plan): Plan {
  return saved.album === null
    ? saved
    : {
        ...saved,
        album: {
          ...saved.album,
          photos: saved.album.photos.map((each) => resolvedPhoto(each, client.url)),
        },
      };
}

export type SubplanTarget = { planId: string; subplanId: string };

type Post = (path: string, body?: unknown) => Promise<Plan>;

function subplanCalls(client: HttpClient, post: Post) {
  return {
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

export function createPlansApi(client: HttpClient) {
  async function post(path: string, body?: unknown) {
    const saved = await client.request(path, { method: "POST", body, schema: plan });

    return resolvedPlan(client, saved);
  }

  return {
    async list() {
      const plans = await client.request("/api/plans", { schema: planList });

      return plans.map((each) => resolvedPlan(client, each));
    },
    albums: async () => client.request("/api/albums", { schema: albumList }),

    create: async (change: PlanChange) => post("/api/plans", change),
    async update(planId: string, change: PlanChange) {
      const saved = await client.request(`/api/plans/${planId}`, {
        method: "PUT",
        body: change,
        schema: plan,
      });

      return resolvedPlan(client, saved);
    },
    remove: async (planId: string) =>
      client.request(`/api/plans/${planId}`, { method: "DELETE", schema: planDeleted }),
    complete: async (planId: string) => post(`/api/plans/${planId}/complete`),
    reopen: async (planId: string) => post(`/api/plans/${planId}/reopen`),

    ...subplanCalls(client, post),
  };
}

export type PlansApi = ReturnType<typeof createPlansApi>;
