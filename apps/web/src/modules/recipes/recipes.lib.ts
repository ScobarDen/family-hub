import type { Photo, Recipe } from "@family-hub/contract";

export type RecipeItem = {
  id: string;
  title: string;
  isFavorite: boolean;
  subtitle: string | undefined;
};

export type RecipeDetails = {
  id: string;
  title: string;
  photos: Photo[];
  ingredients: string[];
  method: string | null;
  isFavorite: boolean;
  canDelete: boolean;
};

export function toRecipeItem({ id, title, isFavorite, tags }: Recipe): RecipeItem {
  return {
    id,
    title,
    isFavorite,
    subtitle: tags.map(({ name }) => name).join(" · ") || undefined,
  };
}

export function toRecipeDetails(recipe: Recipe): RecipeDetails {
  return {
    id: recipe.id,
    title: recipe.title,
    photos: recipe.photos,
    ingredients: recipe.ingredients,
    method: recipe.method,
    isFavorite: recipe.isFavorite,
    canDelete: recipe.canDelete,
  };
}
