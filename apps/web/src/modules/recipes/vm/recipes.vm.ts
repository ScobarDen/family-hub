import {
  action,
  atom,
  type Atom,
  computed,
  reatomSet,
  type SetAtom,
  withAsync,
  withAsyncData,
  wrap,
} from "@reatom/core";

import type { Recipe, RecipeTag } from "@family-hub/contract";

import { formatCount } from "@/common/format-count";
import type { PreparedPhoto } from "@/common/photo";
import { reatomPhotoViewer } from "@/common/photo-viewer";
import { detached, readOnly } from "@/common/state";
import { type Confirmation, type Dialogs, didSucceedOrAlert, isConfirmed } from "@/common/telegram";

import type { RecipesApi } from "../recipes.api.ts";
import {
  toRecipeDetails,
  toRecipeItem,
  type RecipeDetails,
  type RecipeItem,
} from "../recipes.lib.ts";
import { reatomRecipesData, type RecipesData } from "../recipes.model.ts";
import { reatomRecipeCooks } from "./recipe-cooks.vm.ts";
import { reatomRecipeForm } from "./recipe-form.vm.ts";
import { reatomTagEditing } from "./recipe-tags.vm.ts";

const recipeWords = { one: "рецепт", few: "рецепта", many: "рецептов", other: "рецепта" };

function isFilteredBy({ text, tagId, isFavorite }: RecipesData): boolean {
  return text() !== "" || tagId() !== undefined || isFavorite();
}

// An empty list says whether the book is empty or the search found nothing in it.
function listScreenOf(
  list: Recipe[],
  { tags, isFiltered }: { tags: RecipeTag[]; isFiltered: boolean },
): RecipesScreen {
  const isBookEmpty = list.length === 0 && !isFiltered;

  return {
    kind: "list",
    recipes: list.map(toRecipeItem),
    tags,
    summary: isBookEmpty ? "Пока нет рецептов" : formatCount(list.length, recipeWords),
    empty: list.length === 0 && isFiltered ? "Ничего не нашлось" : undefined,
  };
}

export type RecipesScreen =
  | { kind: "loading" }
  | { kind: "failed" }
  | {
      kind: "list";
      recipes: RecipeItem[];
      tags: RecipeTag[];
      summary: string;
      empty: string | undefined;
    }
  | { kind: "recipe"; recipe: RecipeDetails; checked: number[] }
  | { kind: "form"; isCreating: boolean; tags: RecipeTag[] }
  | { kind: "tags"; tags: RecipeTag[] };

type RecipesDependencies = {
  api: RecipesApi;
  telegram: Dialogs;
  preparePhoto: (file: Blob) => Promise<PreparedPhoto>;
  photoHint: () => string | undefined;
  today: () => string;
  timeZone: () => string;
};

type Navigation = {
  openedId: Atom<string | undefined>;
  editing: Atom<"recipe" | "tags" | undefined>;
  // Ticked ingredients live on the screen only: they are for the cook at the stove.
  checked: SetAtom<number>;
};

const deleteQuestion: Confirmation = {
  title: "Удалить рецепт?",
  message: "Рецепт пропадёт у всей семьи вместе со своими фото.",
  button: "Удалить рецепт",
};

function reatomOpened(
  api: RecipesApi,
  { data, navigation }: { data: RecipesData; navigation: Navigation },
) {
  return computed(async () => {
    data.version();
    const recipeId = navigation.openedId();

    return recipeId === undefined ? undefined : wrap(api.get(recipeId));
  }, "recipes.opened").extend(withAsyncData());
}

type Opened = ReturnType<typeof reatomOpened>;

function reatomScreen({
  data,
  navigation,
  opened,
  form,
  timeZone,
}: {
  data: RecipesData;
  navigation: Navigation;
  opened: Opened;
  form: { isCreating: () => boolean };
  timeZone: () => string;
}) {
  return computed((): RecipesScreen => {
    const tags = data.tags.data() ?? [];
    const editing = navigation.editing();

    if (editing !== undefined) {
      return editing === "tags"
        ? { kind: "tags", tags }
        : { kind: "form", isCreating: form.isCreating(), tags };
    }

    const recipe = opened.data();

    if (navigation.openedId() !== undefined && recipe !== undefined) {
      return {
        kind: "recipe",
        recipe: toRecipeDetails(recipe, timeZone()),
        checked: [...navigation.checked()],
      };
    }

    const list = data.list.data();

    if (list === undefined) {
      return data.list.error() === undefined ? { kind: "loading" } : { kind: "failed" };
    }

    return listScreenOf(list, {
      tags,
      isFiltered: isFilteredBy(data),
    });
  }, "recipes.screen");
}

function reatomRecipeRemoval(
  { api, telegram }: RecipesDependencies,
  { data, navigation, opened }: { data: RecipesData; navigation: Navigation; opened: Opened },
) {
  return action(async () => {
    const recipe = opened.data();
    const isSure = await wrap(isConfirmed(telegram, deleteQuestion));

    if (recipe === undefined || !isSure) {
      return;
    }

    const isRemoved = await wrap(
      didSucceedOrAlert(telegram, {
        failure: "Не получилось удалить рецепт. Попробуйте ещё раз.",
        call: api.remove(recipe.id),
      }),
    );

    if (isRemoved) {
      navigation.openedId.set(undefined);
      data.reload();
    }
  }, "recipes.remove").extend(withAsync());
}

function reatomRecipeActions(
  dependencies: RecipesDependencies,
  sources: { data: RecipesData; navigation: Navigation; opened: Opened },
) {
  const { data, navigation, opened } = sources;
  const { api, telegram } = dependencies;
  const remove = reatomRecipeRemoval(dependencies, sources);
  const favorite = action(async () => {
    const recipe = opened.data();

    const isMarked =
      recipe !== undefined &&
      (await wrap(
        didSucceedOrAlert(telegram, {
          failure: "Не получилось отметить рецепт. Попробуйте ещё раз.",
          call: api.setFavorite(recipe.id, !recipe.isFavorite),
        }),
      ));

    if (isMarked) {
      data.reload();
    }
  }, "recipes.favorite").extend(withAsync());

  return {
    remove: detached(remove, "recipes.removeRecipe"),
    toggleFavorite: detached(favorite, "recipes.toggleFavorite"),
    toggleIngredient: action((index: number) => {
      navigation.checked.toggle(index);
    }, "recipes.toggleIngredient"),
  };
}

function reatomFilters(data: RecipesData) {
  return {
    text: readOnly(data.text),
    tagId: readOnly(data.tagId),
    isFavorite: readOnly(data.isFavorite),
    search: action((text: string) => {
      data.text.set(text);
    }, "recipes.search"),
    chooseTag: action((tagId: string | undefined) => {
      data.tagId.set(data.tagId() === tagId ? undefined : tagId);
    }, "recipes.chooseTag"),
    toggleFavorites: action(() => {
      data.isFavorite.set(!data.isFavorite());
    }, "recipes.toggleFavorites"),
    resetFilters: action(() => {
      data.text.set("");
      data.tagId.set(undefined);
      data.isFavorite.set(false);
    }, "recipes.resetFilters"),
  };
}

function reatomMoves({
  navigation,
  opened,
  form,
}: {
  navigation: Navigation;
  opened: Opened;
  form: ReturnType<typeof reatomRecipeForm>;
}) {
  return {
    open: action((recipeId: string) => {
      navigation.openedId.set(recipeId);
      navigation.checked.clear();
    }, "recipes.open"),
    add: action(() => {
      form.startCreating();
      navigation.editing.set("recipe");
    }, "recipes.add"),
    edit: action(() => {
      const recipe = opened.data();

      if (recipe !== undefined) {
        form.startEditing(recipe);
        navigation.editing.set("recipe");
      }
    }, "recipes.edit"),
    openTags: action(() => {
      navigation.editing.set("tags");
    }, "recipes.openTags"),
    back: action(() => {
      if (navigation.editing() === undefined) {
        navigation.openedId.set(undefined);
      } else {
        navigation.editing.set(undefined);
      }
    }, "recipes.back"),
  };
}

export function reatomRecipesScreen(dependencies: RecipesDependencies) {
  const navigation: Navigation = {
    openedId: atom<string | undefined>(undefined, "recipes.openedId"),
    editing: atom<"recipe" | "tags" | undefined>(undefined, "recipes.editing"),
    checked: reatomSet<number>([], "recipes.checked"),
  };
  const data = reatomRecipesData(dependencies);
  const opened = reatomOpened(dependencies.api, { data, navigation });
  const form = reatomRecipeForm({
    ...dependencies,
    onSaved: (saved) => {
      navigation.editing.set(undefined);
      navigation.openedId.set(saved.id);
      data.reload();
    },
  });
  const screen = reatomScreen({ data, navigation, opened, form, timeZone: dependencies.timeZone });

  return {
    screen,
    form,
    photoHint: readOnly(dependencies.photoHint),
    title: computed(() => titleOf(screen()), "recipes.title"),
    retry: data.reload,
    canGoBack: computed(
      () => navigation.editing() !== undefined || navigation.openedId() !== undefined,
      "recipes.canGoBack",
    ),
    viewer: reatomPhotoViewer({ ...dependencies, onDeleted: data.reload }),
    ...reatomFilters(data),
    ...reatomRecipeActions(dependencies, { data, navigation, opened }),
    ...reatomTagEditing(dependencies, data),
    ...reatomRecipeCooks(dependencies, { data, opened: () => opened.data() }),
    ...reatomMoves({ navigation, opened, form }),
  };
}

function titleOf(screen: RecipesScreen): string {
  if (screen.kind === "recipe") {
    return screen.recipe.title;
  }

  if (screen.kind === "form") {
    return screen.isCreating ? "Новый рецепт" : "Рецепт";
  }

  return screen.kind === "tags" ? "Теги" : "Рецепты";
}

export type RecipesScreenModel = ReturnType<typeof reatomRecipesScreen>;
