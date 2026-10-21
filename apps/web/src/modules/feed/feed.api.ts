import { feedPage, photoDeleted, plan, type FeedPage } from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";
import { resolvedPhoto } from "@/common/photo";

export type PlanStep = { planId: string; subplanId: string | null };

// Thumbnails are the Worker's signed paths; the browser loads them from its origin.
function resolvedPage(client: HttpClient, page: FeedPage): FeedPage {
  return {
    ...page,
    activity: page.activity.map((item) =>
      item.kind === "care" || item.kind === "upload" || item.kind === "cooked"
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
    deletePhoto: async (photoId: string) =>
      client.request(`/api/photos/${photoId}`, { method: "DELETE", schema: photoDeleted }),
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
