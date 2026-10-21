import {
  action,
  atom,
  computed,
  noop,
  withAsync,
  withAsyncData,
  wrap,
  type Atom,
} from "@reatom/core";

import type { Recipe, RecipeTag } from "@family-hub/contract";

import type { PreparedPhoto } from "@/common/photo";
import { reatomPhotoViewer } from "@/common/photo-viewer";
import type { PopupParams } from "@/common/telegram";

import type { RecipesApi } from "../recipes.api.ts";
import { reatomRecipesData, type RecipesData } from "../recipes.model.ts";
import { reatomRecipeCooks } from "./recipe-cooks.vm.ts";
import { reatomRecipeForm } from "./recipe-form.vm.ts";
import { reatomTagEditing } from "./recipe-tags.vm.ts";

export type RecipesScreen =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "list"; recipes: Recipe[]; tags: RecipeTag[] }
  | { kind: "recipe"; recipe: Recipe; checked: number[] }
  | { kind: "form"; isCreating: boolean; tags: RecipeTag[] }
  | { kind: "tags"; tags: RecipeTag[] };

type RecipesDependencies = {
  api: RecipesApi;
  telegram: { showPopup: (params: PopupParams) => Promise<string | undefined> };
  preparePhoto: (file: Blob) => Promise<PreparedPhoto>;
  photoHint: () => string | undefined;
  today: () => string;
  timeZone: () => string;
};

type Navigation = {
  openedId: Atom<string | undefined>;
  editing: Atom<"recipe" | "tags" | undefined>;
  // Ticked ingredients live on the screen only: they are for the cook at the stove.
  checked: Atom<number[]>;
};

const deleteQuestion: PopupParams = {
  title: "Удалить рецепт?",
  message: "Рецепт пропадёт у всей семьи вместе со своими фото.",
  buttons: [
    { id: "delete", type: "destructive", text: "Удалить" },
    { id: "cancel", type: "cancel" },
  ],
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
}: {
  data: RecipesData;
  navigation: Navigation;
  opened: Opened;
  form: { isCreating: () => boolean };
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
      return { kind: "recipe", recipe, checked: navigation.checked() };
    }

    const list = data.list.data();

    if (list === undefined) {
      return data.list.error() === undefined ? { kind: "loading" } : { kind: "failed" };
    }

    return { kind: "list", recipes: list, tags };
  }, "recipes.screen");
}

function reatomRecipeActions(
  dependencies: RecipesDependencies,
  { data, navigation, opened }: { data: RecipesData; navigation: Navigation; opened: Opened },
) {
  const remove = action(async () => {
    const recipe = opened.data();
    const choice = await wrap(dependencies.telegram.showPopup(deleteQuestion));

    if (recipe !== undefined && choice === "delete") {
      await wrap(dependencies.api.remove(recipe.id));
      navigation.openedId.set(undefined);
      data.reload();
    }
  }, "recipes.remove").extend(withAsync());
  const favorite = action(async () => {
    const recipe = opened.data();

    if (recipe !== undefined) {
      await wrap(dependencies.api.setFavorite(recipe.id, !recipe.isFavorite));
      data.reload();
    }
  }, "recipes.favorite").extend(withAsync());

  return {
    remove: action(() => {
      remove().catch(noop);
    }, "recipes.removeRecipe"),
    toggleFavorite: action(() => {
      favorite().catch(noop);
    }, "recipes.toggleFavorite"),
    toggleIngredient: action((index: number) => {
      const current = navigation.checked();

      navigation.checked.set(
        current.includes(index) ? current.filter((each) => each !== index) : [...current, index],
      );
    }, "recipes.toggleIngredient"),
  };
}

function reatomFilters(data: RecipesData) {
  return {
    text: computed(() => data.text(), "recipes.searchText"),
    tagId: computed(() => data.tagId(), "recipes.chosenTag"),
    isFavorite: computed(() => data.isFavorite(), "recipes.isFavoriteShown"),
    search: action((text: string) => {
      data.text.set(text);
    }, "recipes.search"),
    chooseTag: action((tagId: string | undefined) => {
      data.tagId.set(data.tagId() === tagId ? undefined : tagId);
    }, "recipes.chooseTag"),
    toggleFavorites: action(() => {
      data.isFavorite.set(!data.isFavorite());
    }, "recipes.toggleFavorites"),
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
      navigation.checked.set([]);
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
    checked: atom<number[]>([], "recipes.checked"),
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
  const screen = reatomScreen({ data, navigation, opened, form });

  return {
    screen,
    form,
    title: computed(() => titleOf(screen()), "recipes.title"),
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
