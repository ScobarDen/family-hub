import {
  albumList,
  deleted,
  task,
  taskList,
  type SubtaskChange,
  type Task,
  type TaskChange,
} from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";
import { resolvedPhoto } from "@/common/photo";

// The Album strip and the Pet Avatar are the Worker's signed paths; the browser loads them from its
// origin.
function resolvedTask(client: HttpClient, saved: Task): Task {
  return {
    ...saved,
    pet:
      saved.pet === null || saved.pet.picture === null
        ? saved.pet
        : { ...saved.pet, picture: client.url(saved.pet.picture) },
    album:
      saved.album === null
        ? null
        : {
            ...saved.album,
            photos: saved.album.photos.map((each) => resolvedPhoto(each, client.url)),
          },
  };
}

export type SubtaskTarget = { taskId: string; subtaskId: string };

export type OccurrenceTarget = { taskId: string; occurrence: string | null };

type Method = Parameters<HttpClient["request"]>[1]["method"];

function subtaskPath({ taskId, subtaskId }: SubtaskTarget): string {
  return `/api/tasks/${taskId}/subtasks/${subtaskId}`;
}

export function createTasksApi(client: HttpClient) {
  async function send(
    path: string,
    { method = "POST", body }: { method?: Method; body?: unknown } = {},
  ) {
    return resolvedTask(client, await client.request(path, { method, body, schema: task }));
  }

  return {
    async list() {
      const tasks = await client.request("/api/tasks", { schema: taskList });

      return tasks.map((each) => resolvedTask(client, each));
    },
    albums: async () => client.request("/api/albums", { schema: albumList }),

    create: async (change: TaskChange) => send("/api/tasks", { body: change }),
    update: async (taskId: string, change: TaskChange) =>
      send(`/api/tasks/${taskId}`, { method: "PUT", body: change }),
    remove: async (taskId: string) =>
      client.request(`/api/tasks/${taskId}`, { method: "DELETE", schema: deleted }),
    complete: async ({ taskId, occurrence }: OccurrenceTarget) =>
      send(`/api/tasks/${taskId}/complete`, { body: { occurrence } }),
    reopen: async ({ taskId, occurrence }: OccurrenceTarget) =>
      send(`/api/tasks/${taskId}/reopen`, { body: { occurrence } }),
    skip: async (taskId: string, date: string) =>
      send(`/api/tasks/${taskId}/skip`, { body: { date } }),

    addSubtask: async (taskId: string, change: SubtaskChange) =>
      send(`/api/tasks/${taskId}/subtasks`, { body: change }),
    updateSubtask: async (target: SubtaskTarget, change: SubtaskChange) =>
      send(subtaskPath(target), { method: "PUT", body: change }),
    removeSubtask: async (target: SubtaskTarget) => send(subtaskPath(target), { method: "DELETE" }),
    completeSubtask: async (target: SubtaskTarget) => send(`${subtaskPath(target)}/complete`),
    reopenSubtask: async (target: SubtaskTarget) => send(`${subtaskPath(target)}/reopen`),
  };
}

export type TasksApi = ReturnType<typeof createTasksApi>;
