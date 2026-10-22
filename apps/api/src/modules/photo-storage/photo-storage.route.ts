import { Hono } from "hono";

import type { PhotoStorage } from "@family-hub/contract";

import { requireMember, type AuthEnv } from "@/common/auth";

import type { PhotoStorageService } from "./photo-storage.service.ts";

type PhotoStorageEnv = {
  Variables: AuthEnv["Variables"] & { photoStorage: PhotoStorageService };
};

export const photoStorageRoute = new Hono<PhotoStorageEnv>().get(
  "/api/family/photo-storage",
  requireMember,
  async (context) =>
    context.json<PhotoStorage>(await context.var.photoStorage.status(context.var.membership)),
);
