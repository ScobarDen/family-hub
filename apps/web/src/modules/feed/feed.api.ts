import { feedPage, task, type FeedPage } from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";
import { createPhotoCalls, resolvedPhoto, resolvedUpcoming } from "@/common/photo";

export type OccurrenceTarget = { taskId: string; occurrence: string; subtaskId: string | null };

// Thumbnails are the Worker's signed paths; the browser loads them from its origin.
function resolvedPage(client: HttpClient, page: FeedPage): FeedPage {
  return {
    ...page,
    overdue: page.overdue.map((item) => resolvedUpcoming(item, client.url)),
    upcoming: page.upcoming.map((item) => resolvedUpcoming(item, client.url)),
    activity: page.activity.map((item) =>
      item.kind === "care" || item.kind === "upload"
        ? { ...item, photos: item.photos.map((each) => resolvedPhoto(each, client.url)) }
        : item,
    ),
  };
}

export function createFeedApi(client: HttpClient) {
  return {
    async page(before?: string) {
      const page = await client.request(
        before === undefined ? "/api/feed" : `/api/feed?before=${encodeURIComponent(before)}`,
        { schema: feedPage },
      );

      return resolvedPage(client, page);
    },
    deletePhoto: createPhotoCalls(client).deletePhoto,
    // A Subtask has no Occurrences of its own: it is completed whole.
    complete: async ({ taskId, occurrence, subtaskId }: OccurrenceTarget) =>
      subtaskId === null
        ? client.request(`/api/tasks/${taskId}/complete`, {
            method: "POST",
            body: { occurrence },
            schema: task,
          })
        : client.request(`/api/tasks/${taskId}/subtasks/${subtaskId}/complete`, {
            method: "POST",
            schema: task,
          }),
  };
}

export type FeedApi = ReturnType<typeof createFeedApi>;
