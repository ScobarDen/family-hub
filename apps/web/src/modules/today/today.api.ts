import { plan, today, type Plan, type Today } from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";
import { resolvedUpcoming } from "@/common/photo";

export type PlanOrSubplan = { planId: string; subplanId: string | null };

function pathOf({ planId, subplanId }: PlanOrSubplan): string {
  return subplanId === null ? `/api/plans/${planId}` : `/api/plans/${planId}/subplans/${subplanId}`;
}

// Completing a Plan closes its open Subplans at the same moment, so those are the ones to reopen.
function closedWith(completed: Plan, target: PlanOrSubplan): PlanOrSubplan[] {
  const at = completed.completed?.at;

  return target.subplanId !== null || at === undefined
    ? []
    : completed.subplans
        .filter(({ completed: subplanCompleted }) => subplanCompleted?.at === at)
        .map(({ id }) => ({ planId: target.planId, subplanId: id }));
}

// The Pets' pictures are the Worker's signed paths; the browser loads them from its origin.
function resolvedToday(client: HttpClient, loaded: Today): Today {
  const only = loaded.tiles.pet?.only;
  const picture = only?.picture ?? null;

  return {
    ...loaded,
    due: loaded.due.map((item) => resolvedUpcoming(item, client.url)),
    next: loaded.next.map((item) => resolvedUpcoming(item, client.url)),
    tiles:
      loaded.tiles.pet === null || only === undefined || only === null || picture === null
        ? loaded.tiles
        : {
            ...loaded.tiles,
            pet: { ...loaded.tiles.pet, only: { ...only, picture: client.url(picture) } },
          },
  };
}

export function createTodayApi(client: HttpClient) {
  async function post(path: string): Promise<Plan> {
    return client.request(path, { method: "POST", schema: plan });
  }

  return {
    load: async () => resolvedToday(client, await client.request("/api/today", { schema: today })),
    complete: async (target: PlanOrSubplan) => post(`${pathOf(target)}/complete`),
    async reopen(target: PlanOrSubplan, completed: Plan): Promise<void> {
      await post(`${pathOf(target)}/reopen`);

      for (const subplan of closedWith(completed, target)) {
        await post(`${pathOf(subplan)}/reopen`);
      }
    },
  };
}

export type TodayApi = ReturnType<typeof createTodayApi>;
