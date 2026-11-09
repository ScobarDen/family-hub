import { z } from "zod";

import { appModule, type AppModule } from "./member.ts";

// A browser WebSocket cannot send `authorization`, so the session token rides beside this protocol.
export const liveProtocol = "family-hub.live";

export const livePath = "/api/live";

// Names the open app that made a write, so its own echo tells it nothing new.
export const liveClientHeader = "x-live-client";

export const liveClientId = z.uuid();

// On connection the Object hands over every module's version; after a write, the versions it moved.
export const liveMessage = z.object({
  versions: z.partialRecord(appModule, z.int().nonnegative()),
  writer: liveClientId.optional(),
});

export type LiveMessage = z.infer<typeof liveMessage>;

// The first segment after `/api/` names what a write changed; the Feed and Today read every module.
// Pets carry their Tasks and birthdays, and a Care Entry may create a follow-up Task.
const modulesByPath = new Map<string, AppModule[]>([
  ["tasks", ["tasks", "pet"]],
  ["pets", ["pet", "tasks"]],
  ["care-entries", ["pet", "tasks"]],
  ["goals", ["goals"]],
  ["albums", ["albums"]],
  ["photos", ["albums"]],
  ["recipes", ["recipes"]],
  ["recipe-tags", ["recipes"]],
  ["family", ["feed"]],
]);

export function modulesOfPath(path: string): AppModule[] {
  return modulesByPath.get(new URL(path, "http://path").pathname.split("/")[2] ?? "") ?? [];
}
