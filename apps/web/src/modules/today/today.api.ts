import { task, today, type Today } from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";
import { resolvedUpcoming } from "@/common/photo";

export type OccurrenceTarget = { taskId: string; occurrence: string; subtaskId: string | null };

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
  // A Subtask has no Occurrences of its own: it is completed whole.
  async function post({ taskId, occurrence, subtaskId }: OccurrenceTarget, verb: string) {
    await (subtaskId === null
      ? client.request(`/api/tasks/${taskId}/${verb}`, {
          method: "POST",
          body: { occurrence },
          schema: task,
        })
      : client.request(`/api/tasks/${taskId}/subtasks/${subtaskId}/${verb}`, {
          method: "POST",
          schema: task,
        }));
  }

  return {
    load: async () => resolvedToday(client, await client.request("/api/today", { schema: today })),
    complete: async (target: OccurrenceTarget) => post(target, "complete"),
    reopen: async (target: OccurrenceTarget) => post(target, "reopen"),
  };
}

export type TodayApi = ReturnType<typeof createTodayApi>;
