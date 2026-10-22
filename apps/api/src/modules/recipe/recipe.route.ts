import { Hono, type Context } from "hono";

import {
  cookedChange,
  recipeChange,
  recipeFavorite,
  recipeTagChange,
  type Recipe,
  type RecipeTag,
} from "@family-hub/contract";

import { requireMember, type MemberEnv } from "@/common/auth";
import { httpStatus, jsonBody, refusalsOf } from "@/common/errors";

import type { RecipeRefusal, RecipeResult } from "./recipe.types.ts";
import type { RecipeService } from "./service/recipe.service.ts";

type RecipeEnv = {
  Variables: MemberEnv["Variables"] & { recipes: RecipeService };
};

const refuse = refusalsOf<RecipeRefusal>({
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
});

function reply(context: Context<RecipeEnv>, result: RecipeResult) {
  return result.status === "ok"
    ? context.json<Recipe>(result.recipe)
    : refuse(context, result.status);
}

const tagRoute = new Hono<RecipeEnv>()
  .use("/api/recipe-tags/*", requireMember)
  .get("/api/recipe-tags", async (context) =>
    context.json<RecipeTag[]>(await context.var.recipes.tags(context.var.membership)),
  )
  .post(
    "/api/recipe-tags",
    jsonBody(recipeTagChange, "A Recipe needs a title; a tag needs a name"),
    async (context) =>
      context.json<RecipeTag>(
        await context.var.recipes.addTag(context.var.membership, context.req.valid("json").name),
        httpStatus.created,
      ),
  )
  .put(
    "/api/recipe-tags/:id",
    jsonBody(recipeTagChange, "A Recipe needs a title; a tag needs a name"),
    async (context) => {
      const result = await context.var.recipes.renameTag(
        context.var.membership,
        context.req.param("id"),
        context.req.valid("json").name,
      );

      return result.status === "ok"
        ? context.json<RecipeTag>(result.tag)
        : refuse(context, result.status);
    },
  )
  .delete("/api/recipe-tags/:id", async (context) => {
    const result = await context.var.recipes.removeTag(
      context.var.membership,
      context.req.param("id"),
    );

    return result.status === "deleted" ? context.json(result) : refuse(context, result.status);
  });

export const recipeRoute = new Hono<RecipeEnv>()
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
  .post(
    "/api/recipes",
    jsonBody(recipeChange, "A Recipe needs a title; a tag needs a name"),
    async (context) => {
      const result = await context.var.recipes.create(
        context.var.membership,
        context.req.valid("json"),
      );

      return result.status === "ok"
        ? context.json<Recipe>(result.recipe, httpStatus.created)
        : refuse(context, result.status);
    },
  )
  .get("/api/recipes/:id", async (context) =>
    reply(context, await context.var.recipes.get(context.var.membership, context.req.param("id"))),
  )
  .put(
    "/api/recipes/:id",
    jsonBody(recipeChange, "A Recipe needs a title; a tag needs a name"),
    async (context) =>
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
  .put(
    "/api/recipes/:id/favorite",
    jsonBody(recipeFavorite, "A Recipe needs a title; a tag needs a name"),
    async (context) =>
      reply(
        context,
        await context.var.recipes.setFavorite(
          context.var.membership,
          context.req.param("id"),
          context.req.valid("json").isFavorite,
        ),
      ),
  )
  .post(
    "/api/recipes/:id/cooked",
    jsonBody(cookedChange, "A Recipe needs a title; a tag needs a name"),
    async (context) =>
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
