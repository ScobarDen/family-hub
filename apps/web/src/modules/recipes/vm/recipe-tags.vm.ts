import { action, atom, reatomMap, withAsync, wrap } from "@reatom/core";

import { recipeTagNameMaxLength, type RecipeTag } from "@family-hub/contract";

import { withoutId } from "@/common/records.lib.ts";
import {
  detached,
  readOnly,
  reatomFailure,
  reatomOptimistic,
  type RollbackFailure,
} from "@/modules/changes";
import { type Confirmation, type Dialogs, isConfirmed, type Haptics } from "@/modules/telegram";

import type { RecipesApi } from "../recipes.api.ts";
import type { RecipesData } from "../recipes.model.ts";

type TagDependencies = {
  api: RecipesApi;
  telegram: Pick<Dialogs, "showPopup"> & { haptics: Haptics };
};

const deleteQuestion: Confirmation = {
  title: "Удалить тег?",
  message: "Тег снимется со всех рецептов; сами рецепты останутся.",
  button: "Удалить",
};

function nameOf(text: string): string | undefined {
  const name = text.trim();

  return name === "" || name.length > recipeTagNameMaxLength ? undefined : name;
}

type Change = (doing: () => Promise<unknown>) => Promise<void>;

// The new tag's text and the names being typed over tags stay until the server takes them.
function reatomTagTyping(api: RecipesApi, change: Change) {
  const newTag = atom("", "recipes.tags.newTag");
  const renamed = reatomMap<string, string>(new Map(), "recipes.tags.renamed");
  const add = action(async () => {
    const name = nameOf(newTag());

    if (name !== undefined) {
      await wrap(change(async () => api.addTag(name)));
      newTag.set("");
    }
  }, "recipes.tags.addTyped").extend(withAsync());
  const rename = action(async (tagId: string) => {
    const name = nameOf(renamed().get(tagId) ?? "");

    try {
      if (name !== undefined) {
        await wrap(change(async () => api.renameTag(tagId, name)));
      }
    } finally {
      renamed.delete(tagId);
    }
  }, "recipes.tags.renameTyped").extend(withAsync());

  return {
    newTag: readOnly(newTag),
    typeNewTag: action((text: string) => {
      newTag.set(text);
    }, "recipes.tags.typeNew"),
    addTag: detached(add, "recipes.tags.add"),
    tagNameOf: (tag: RecipeTag) => renamed().get(tag.id) ?? tag.name,
    typeTagName: action((tagId: string, text: string) => {
      renamed.set(tagId, text);
    }, "recipes.tags.typeName"),
    renameTag: detached(rename, "recipes.tags.rename"),
  };
}

// The Family's tags: anyone adds, renames or deletes one.
export function reatomTagEditing(
  { api, telegram }: TagDependencies,
  { data, failure }: { data: RecipesData; failure: RollbackFailure },
) {
  const change = action(async (doing: () => Promise<unknown>) => {
    await wrap(doing());
    data.reload();
  }, "recipes.tags.change").extend(withAsync());
  const remove = reatomOptimistic(
    async (tagId: string) => {
      if (!(await wrap(isConfirmed(telegram, deleteQuestion)))) {
        return;
      }

      data.tags.data.set(withoutId(data.tags.data() ?? [], tagId));
      await wrap(api.removeTag(tagId));
      data.reload();
    },
    {
      name: "recipes.tags.removeAsked",
      failure,
      refusal: "Не получилось удалить тег. Попробуйте ещё раз.",
    },
  );

  return {
    tagFailure: reatomFailure(change, {
      message: "Не получилось сохранить тег. Попробуйте ещё раз.",
      name: "recipes.tags.failure",
      haptics: telegram.haptics,
    }),
    ...reatomTagTyping(api, change),
    removeTag: detached(remove, "recipes.tags.remove"),
  };
}
