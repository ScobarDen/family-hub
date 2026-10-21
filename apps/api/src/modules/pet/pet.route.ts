import { sValidator } from "@hono/standard-validator";
import { Hono, type Context } from "hono";

import {
  petAvatar,
  petDeletion,
  petMemoChange,
  petProfile,
  type ErrorCode,
  type Pet,
  type PetDeleted,
  type PetList,
} from "@family-hub/contract";

import { requireMember, type MemberEnv } from "@/common/auth";
import { apiError, httpStatus } from "@/common/errors";

import type { PetRefusal, PetResult } from "./pet.types.ts";
import type { PetService } from "./service/pet.service.ts";

export type PetEnv = {
  Variables: MemberEnv["Variables"] & { pets: PetService };
};

const refusals = {
  "not-found": {
    code: "PET_NOT_FOUND",
    message: "No such Pet in the Family",
    status: httpStatus.notFound,
  },
  archived: {
    code: "PET_ARCHIVED",
    message: "An archived Pet reads only; unarchive it first",
    status: httpStatus.conflict,
  },
  "not-owner": {
    code: "NOT_FAMILY_OWNER",
    message: "Only the Family Owner deletes a Pet",
    status: httpStatus.forbidden,
  },
  "name-mismatch": {
    code: "PET_NAME_MISMATCH",
    message: "The typed name is not the Pet's name",
    status: httpStatus.badRequest,
  },
  "photo-not-found": {
    code: "PHOTO_NOT_FOUND",
    message: "The avatar is one of the photos of the Pet's own Care Entries",
    status: httpStatus.badRequest,
  },
} as const satisfies Record<PetRefusal, { code: ErrorCode; message: string; status: number }>;

function refuse(context: Context<PetEnv>, refusal: PetRefusal) {
  const { code, message, status } = refusals[refusal];

  return context.json(apiError(code, message), status);
}

function reply(context: Context<PetEnv>, result: PetResult) {
  return result.status === "ok" ? context.json<Pet>(result.pet) : refuse(context, result.status);
}

function bodyOf<
  Schema extends typeof petProfile | typeof petMemoChange | typeof petDeletion | typeof petAvatar,
>(schema: Schema, message: string) {
  return sValidator("json", schema, (result, context) =>
    result.success
      ? undefined
      : context.json(apiError("INVALID_REQUEST", message), httpStatus.badRequest),
  );
}

const profileBody = bodyOf(petProfile, "A Pet needs a name and a species");
const memoBody = bodyOf(petMemoChange, "The Pet Memo takes food, clinic and important notes");
const deletionBody = bodyOf(petDeletion, "Deleting a Pet takes its name");
const avatarBody = bodyOf(petAvatar, "The avatar takes a photo id or null");

export const petRoute = new Hono<PetEnv>()
  .use("/api/pets", requireMember)
  .use("/api/pets/:id", requireMember)
  .use("/api/pets/:id/memo", requireMember)
  .use("/api/pets/:id/archive", requireMember)
  .use("/api/pets/:id/unarchive", requireMember)
  .use("/api/pets/:id/avatar", requireMember)
  .put("/api/pets/:id/avatar", avatarBody, async (context) =>
    reply(
      context,
      await context.var.pets.setAvatar(
        context.var.membership,
        context.req.param("id"),
        context.req.valid("json").photoId,
      ),
    ),
  )
  .get("/api/pets", async (context) =>
    context.json<PetList>(await context.var.pets.list(context.var.membership)),
  )
  .post("/api/pets", profileBody, async (context) =>
    context.json<Pet>(
      await context.var.pets.create(context.var.membership, context.req.valid("json")),
      httpStatus.created,
    ),
  )
  .put("/api/pets/:id", profileBody, async (context) =>
    reply(
      context,
      await context.var.pets.saveProfile(
        context.var.membership,
        context.req.param("id"),
        context.req.valid("json"),
      ),
    ),
  )
  .put("/api/pets/:id/memo", memoBody, async (context) =>
    reply(
      context,
      await context.var.pets.saveMemo(
        context.var.membership,
        context.req.param("id"),
        context.req.valid("json"),
      ),
    ),
  )
  .post("/api/pets/:id/archive", async (context) =>
    reply(context, await context.var.pets.archive(context.var.membership, context.req.param("id"))),
  )
  .post("/api/pets/:id/unarchive", async (context) =>
    reply(
      context,
      await context.var.pets.unarchive(context.var.membership, context.req.param("id")),
    ),
  )
  .delete("/api/pets/:id", deletionBody, async (context) => {
    const result = await context.var.pets.delete(
      context.var.membership,
      context.req.param("id"),
      context.req.valid("json").petName,
    );

    return result.status === "deleted"
      ? context.json<PetDeleted>({ status: "deleted" })
      : refuse(context, result.status);
  });
