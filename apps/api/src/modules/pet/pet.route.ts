import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";

import { petMemoChange, petProfile, type Pet, type PetList } from "@family-hub/contract";

import { requireMember, type AuthEnv } from "@/common/auth";
import { apiError, httpStatus } from "@/common/errors";

import type { PetService } from "./pet.service.ts";

export type PetEnv = {
  Variables: AuthEnv["Variables"] & { pets: PetService };
};

function bodyOf<Schema extends typeof petProfile | typeof petMemoChange>(
  schema: Schema,
  message: string,
) {
  return sValidator("json", schema, (result, context) =>
    result.success
      ? undefined
      : context.json(apiError("INVALID_REQUEST", message), httpStatus.badRequest),
  );
}

const profileBody = bodyOf(petProfile, "A Pet needs a name and a species");
const memoBody = bodyOf(petMemoChange, "The Pet Memo takes food, clinic and important notes");
const petNotFound = apiError("PET_NOT_FOUND", "No such Pet in the Family");

export const petRoute = new Hono<PetEnv>()
  .get("/api/pets", requireMember, async (context) =>
    context.json<PetList>(await context.var.pets.list(context.var.membership)),
  )
  .post("/api/pets", requireMember, profileBody, async (context) =>
    context.json<Pet>(
      await context.var.pets.create(context.var.membership, context.req.valid("json")),
      httpStatus.created,
    ),
  )
  .put("/api/pets/:id", requireMember, profileBody, async (context) => {
    const saved = await context.var.pets.saveProfile(
      context.var.membership,
      context.req.param("id"),
      context.req.valid("json"),
    );

    return saved ? context.json<Pet>(saved) : context.json(petNotFound, httpStatus.notFound);
  })
  .put("/api/pets/:id/memo", requireMember, memoBody, async (context) => {
    const saved = await context.var.pets.saveMemo(
      context.var.membership,
      context.req.param("id"),
      context.req.valid("json"),
    );

    return saved ? context.json<Pet>(saved) : context.json(petNotFound, httpStatus.notFound);
  });
