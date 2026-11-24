import { reatomNavigation } from "../app.route.ts";
import type { Parts } from "./app.vm.ts";
import { reatomOpener } from "./opener.vm.ts";
import { reatomPrefetch } from "./prefetch.vm.ts";
import type { Screens } from "./screens.vm.ts";

// Today and the two tab-bar slot screens load in the background once sign-in returns.
function prefetchOf({ session, shared }: Parts, screens: Screens) {
  return reatomPrefetch({
    isSignedIn: session.isSignedIn,
    slots: shared.tabBarModules.modules,
    today: screens.today.tiles,
    screens: {
      tasks: screens.tasks.screen,
      pet: screens.pet.pets.screen,
      goals: screens.goals.screen,
      albums: screens.albums.screen,
      recipes: screens.recipes.screen,
    },
  });
}

export function reatomRouting(parts: Parts, screens: Screens) {
  const { dependencies, session, shared } = parts;
  const { pet, tasks, goals, albums, recipes, invites, today } = screens;
  const { telegram } = dependencies;
  const navigation = reatomNavigation({
    base: dependencies.base,
    slots: shared.tabBarModules.modules,
    onTodayShown: today.shown,
    isSignedIn: () => session.member() !== undefined,
    telegram,
    slide: dependencies.slide,
    nestedBack: {
      pet: pet.nestedBack,
      tasks: tasks.nestedBack,
      goals: goals.nestedBack,
      albums: albums.nestedBack,
      recipes: recipes.nestedBack,
      profile: invites.nestedBack,
    },
  });
  const opener = reatomOpener({
    telegram,
    navigation,
    isSignedIn: session.isSignedIn,
    pets: pet.pets,
    tasks,
    care: {
      ...pet.care,
      add: () => {
        pet.care.add("note");
      },
    },
    goals,
    albums,
    recipes,
  });

  return { navigation, opener, prefetch: prefetchOf(parts, screens) };
}

export type AppRouting = ReturnType<typeof reatomRouting>;
