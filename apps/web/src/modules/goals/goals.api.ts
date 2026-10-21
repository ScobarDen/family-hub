import {
  familyMemberList,
  goal,
  goalList,
  type GoalChange,
  type GoalOutcome,
  type MovementChange,
} from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";

export type MovementTarget = { goalId: string; movementId: string };

export function createGoalsApi(client: HttpClient) {
  return {
    list: async () => client.request("/api/goals", { schema: goalList }),
    members: async () => client.request("/api/family/members", { schema: familyMemberList }),

    create: async (change: GoalChange) =>
      client.request("/api/goals", { method: "POST", body: change, schema: goal }),
    update: async (goalId: string, change: GoalChange) =>
      client.request(`/api/goals/${goalId}`, { method: "PUT", body: change, schema: goal }),
    complete: async (goalId: string, outcome: GoalOutcome) =>
      client.request(`/api/goals/${goalId}/complete`, {
        method: "POST",
        body: { outcome },
        schema: goal,
      }),

    addMovement: async (goalId: string, change: MovementChange) =>
      client.request(`/api/goals/${goalId}/movements`, {
        method: "POST",
        body: change,
        schema: goal,
      }),
    updateMovement: async ({ goalId, movementId }: MovementTarget, change: MovementChange) =>
      client.request(`/api/goals/${goalId}/movements/${movementId}`, {
        method: "PUT",
        body: change,
        schema: goal,
      }),
    removeMovement: async ({ goalId, movementId }: MovementTarget) =>
      client.request(`/api/goals/${goalId}/movements/${movementId}`, {
        method: "DELETE",
        schema: goal,
      }),
  };
}

export type GoalsApi = ReturnType<typeof createGoalsApi>;
