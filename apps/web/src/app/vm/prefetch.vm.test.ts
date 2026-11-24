import { atom, computed, context, noop, withAsyncData, wrap } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { SlotModule } from "@family-hub/contract";

import { reatomPrefetch } from "./prefetch.vm.ts";

function startPrefetch(slots: SlotModule[] = ["goals", "pet"]) {
  const signedIn = atom(false, "test.signedIn");
  const loaded: string[] = [];

  function screenOf(name: string) {
    return computed(async () => {
      await wrap(Promise.resolve());
      loaded.push(name);

      return name;
    }, `test.${name}`).extend(withAsyncData()).data;
  }

  const screens = {
    tasks: screenOf("tasks"),
    pet: screenOf("pet"),
    goals: screenOf("goals"),
    albums: screenOf("albums"),
    recipes: screenOf("recipes"),
  };
  const prefetch = reatomPrefetch({
    isSignedIn: () => signedIn(),
    slots: () => slots,
    today: screenOf("today"),
    screens,
  });

  return { prefetch, signedIn, loaded, screens };
}

beforeEach(() => {
  context.reset();
});

describe("prefetching after sign-in", () => {
  test("loads Today and both tab-bar slots once the Member is signed in", async () => {
    const { prefetch, signedIn, loaded, screens } = startPrefetch();

    prefetch().catch(noop);
    screens.tasks();
    await vi.waitFor(() => {
      expect(loaded).toContain("tasks");
    });
    expect(loaded).toEqual(["tasks"]);

    signedIn.set(true);

    await vi.waitFor(() => {
      expect(loaded.toSorted()).toEqual(["goals", "pet", "tasks", "today"]);
    });
  });

  test("loads at once when the Member is already signed in", async () => {
    const { prefetch, signedIn, loaded } = startPrefetch(["recipes", "albums"]);

    signedIn.set(true);
    await prefetch();

    await vi.waitFor(() => {
      expect(loaded.toSorted()).toEqual(["albums", "recipes", "today"]);
    });
  });
});
