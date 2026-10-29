import { Hono, type Context } from "hono";

import {
  petAvatar,
  petDeletion,
  petMemoChange,
  petProfile,
  type Pet,
  type Deleted,
  type PetList,
} from "@family-hub/contract";

import { httpStatus, jsonBody, refusalsOf } from "@/common/errors.lib.ts";
import { requireMember, type MemberEnv } from "@/modules/auth";

import type { PetRefusal, PetResult } from "./pet.types.ts";
import type { PetService } from "./service/pet.service.ts";

type PetEnv = {
  Variables: MemberEnv["Variables"] & { pets: PetService };
};

const refuse = refusalsOf<PetRefusal>({
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
    message: "The avatar is a photo of the Pet's own Care Entries or one uploaded for it alone",
    status: httpStatus.badRequest,
  },
});

function reply(context: Context<PetEnv>, result: PetResult) {
  return result.status === "ok" ? context.json<Pet>(result.pet) : refuse(context, result.status);
}

const profileBody = jsonBody(petProfile, "A Pet needs a name and a species");
const memoBody = jsonBody(petMemoChange, "The Pet Memo takes food, clinic and important notes");
const deletionBody = jsonBody(petDeletion, "Deleting a Pet takes its name");
const avatarBody = jsonBody(petAvatar, "The avatar takes a photo id or null");

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
      ? context.json<Deleted>({ status: "deleted" })
      : refuse(context, result.status);
  });
