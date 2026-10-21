import { sValidator } from "@hono/standard-validator";
import { Hono, type Context } from "hono";

import {
  cookedChange,
  recipeChange,
  recipeFavorite,
  recipeTagChange,
  type ErrorCode,
  type Recipe,
  type RecipeTag,
} from "@family-hub/contract";

import { requireMember, type MemberEnv } from "@/common/auth";
import { apiError, httpStatus } from "@/common/errors";

import type { RecipeRefusal, RecipeResult } from "./recipe.types.ts";
import type { RecipeService } from "./service/recipe.service.ts";

export type RecipeEnv = {
  Variables: MemberEnv["Variables"] & { recipes: RecipeService };
};

const refusals = {
  "not-found": {
    code: "RECIPE_NOT_FOUND",
    message: "No such Recipe in the Family",
    status: httpStatus.notFound,
  },
  "not-author": {
    code: "NOT_RECIPE_AUTHOR",
    message: "Only the Member who wrote a Recipe deletes it",
    status: httpStatus.forbidden,
  },
  "tag-not-found": {
    code: "RECIPE_TAG_NOT_FOUND",
    message: "No such Recipe Tag in the Family",
    status: httpStatus.badRequest,
  },
  "photo-not-found": {
    code: "PHOTO_NOT_FOUND",
    message: "Attach photos uploaded to the Family, at most ten",
    status: httpStatus.badRequest,
  },
  "cooked-not-found": {
    code: "COOKED_NOT_FOUND",
    message: "No such «Приготовили» on this Recipe",
    status: httpStatus.notFound,
  },
  "cooked-in-future": {
    code: "COOKED_IN_FUTURE",
    message: "A Recipe is marked cooked for a moment gone by",
    status: httpStatus.badRequest,
  },
} as const satisfies Record<RecipeRefusal, { code: ErrorCode; message: string; status: number }>;

function refuse(context: Context<RecipeEnv>, refusal: RecipeRefusal) {
  const { code, message, status } = refusals[refusal];

  return context.json(apiError(code, message), status);
}

function reply(context: Context<RecipeEnv>, result: RecipeResult) {
  return result.status === "ok"
    ? context.json<Recipe>(result.recipe)
    : refuse(context, result.status);
}

function bodyOf<
  Schema extends
    | typeof recipeChange
    | typeof recipeFavorite
    | typeof recipeTagChange
    | typeof cookedChange,
>(schema: Schema) {
  return sValidator("json", schema, (result, context) =>
    result.success
      ? undefined
      : context.json(
          apiError("INVALID_REQUEST", "A Recipe needs a title; a tag needs a name"),
          httpStatus.badRequest,
        ),
  );
}

const tagRoute = new Hono<RecipeEnv>()
  .use("/api/recipe-tags", requireMember)
  .use("/api/recipe-tags/*", requireMember)
  .get("/api/recipe-tags", async (context) =>
    context.json<RecipeTag[]>(await context.var.recipes.tags(context.var.membership)),
  )
  .post("/api/recipe-tags", bodyOf(recipeTagChange), async (context) =>
    context.json<RecipeTag>(
      await context.var.recipes.addTag(context.var.membership, context.req.valid("json").name),
      httpStatus.created,
    ),
  )
  .put("/api/recipe-tags/:id", bodyOf(recipeTagChange), async (context) => {
    const result = await context.var.recipes.renameTag(
      context.var.membership,
      context.req.param("id"),
      context.req.valid("json").name,
    );

    return result.status === "ok"
      ? context.json<RecipeTag>(result.tag)
      : refuse(context, result.status);
  })
  .delete("/api/recipe-tags/:id", async (context) => {
    const result = await context.var.recipes.removeTag(
      context.var.membership,
      context.req.param("id"),
    );

    return result.status === "deleted" ? context.json(result) : refuse(context, result.status);
  });

export const recipeRoute = new Hono<RecipeEnv>()
  .use("/api/recipes", requireMember)
  .use("/api/recipes/*", requireMember)
  .get("/api/recipes", async (context) =>
    context.json<Recipe[]>(
      await context.var.recipes.list(context.var.membership, {
        text: context.req.query("q"),
        tagId: context.req.query("tag"),
        isFavorite: context.req.query("favorite") === "true",
        sort: context.req.query("sort") === "forgotten" ? "forgotten" : "title",
      }),
    ),
  )
  .post("/api/recipes", bodyOf(recipeChange), async (context) => {
    const result = await context.var.recipes.create(
      context.var.membership,
      context.req.valid("json"),
    );

    return result.status === "ok"
      ? context.json<Recipe>(result.recipe, httpStatus.created)
      : refuse(context, result.status);
  })
  .get("/api/recipes/:id", async (context) =>
    reply(context, await context.var.recipes.get(context.var.membership, context.req.param("id"))),
  )
  .put("/api/recipes/:id", bodyOf(recipeChange), async (context) =>
    reply(
      context,
      await context.var.recipes.update(
        context.var.membership,
        context.req.param("id"),
        context.req.valid("json"),
      ),
    ),
  )
  .delete("/api/recipes/:id", async (context) => {
    const result = await context.var.recipes.remove(
      context.var.membership,
      context.req.param("id"),
    );

    return result.status === "deleted" ? context.json(result) : refuse(context, result.status);
  })
  .put("/api/recipes/:id/favorite", bodyOf(recipeFavorite), async (context) =>
    reply(
      context,
      await context.var.recipes.setFavorite(
        context.var.membership,
        context.req.param("id"),
        context.req.valid("json").isFavorite,
      ),
    ),
  )
  .post("/api/recipes/:id/cooked", bodyOf(cookedChange), async (context) =>
    reply(
      context,
      await context.var.recipes.cook(
        context.var.membership,
        context.req.param("id"),
        context.req.valid("json").cookedAt,
      ),
    ),
  )
  .delete("/api/recipes/:id/cooked/:cookId", async (context) =>
    reply(
      context,
      await context.var.recipes.uncook(
        context.var.membership,
        context.req.param("id"),
        context.req.param("cookId"),
      ),
    ),
  )
  .route("/", tagRoute);
