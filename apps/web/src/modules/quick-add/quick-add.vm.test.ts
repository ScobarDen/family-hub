import { atom, context } from "@reatom/core";
import { beforeEach, expect, test } from "vite-plus/test";

import { fakeHaptics } from "@/modules/telegram";

import { reatomQuickAdd, type QuickAdd } from "./quick-add.vm.ts";

function startQuickAdd() {
  const goalId = atom<string | undefined>("goal-1", "test.goalId");
  const hasPhotoStorage = atom(true, "test.hasPhotoStorage");
  const added: QuickAdd[] = [];
  const uploaded: Blob[][] = [];
  const haptics = fakeHaptics();
  const model = reatomQuickAdd({
    contributionGoalId: goalId,
    canAddPhoto: hasPhotoStorage,
    onQuickAdd: (target) => {
      added.push(target);
    },
    onAddPhotos: (files) => {
      uploaded.push(files);
    },
    telegram: { haptics },
  });

  return { model, goalId, hasPhotoStorage, added, uploaded, felt: haptics.felt };
}

beforeEach(() => {
  context.reset();
});

test("opens with a light tap and offers a Task, a Care Entry, a Contribution and photos", () => {
  const { model, felt } = startQuickAdd();

  model.open();

  expect(model.isOpen()).toBe(true);
  expect(felt).toEqual(["impact light"]);
  expect(model.tiles().map((tile) => tile.title)).toEqual(["Дело", "Запись питомцу", "Взнос"]);
  expect(model.canAddPhoto()).toBe(true);
});

test("leaves out a Contribution without a Savings Goal and photos without Photo Storage", () => {
  const { model, goalId, hasPhotoStorage } = startQuickAdd();

  goalId.set(undefined);
  hasPhotoStorage.set(false);

  expect(model.tiles().map((tile) => tile.title)).toEqual(["Дело", "Запись питомцу"]);
  expect(model.canAddPhoto()).toBe(false);
});

test("closes and opens the form of the tapped tile", () => {
  const { model, added } = startQuickAdd();

  model.open();
  model.add({ kind: "new-contribution", goalId: "goal-1" });

  expect(model.isOpen()).toBe(false);
  expect(added).toEqual([{ kind: "new-contribution", goalId: "goal-1" }]);
});

test("closes and uploads the picked photos, and stays open when none were picked", () => {
  const { model, uploaded } = startQuickAdd();
  const photo = new Blob(["Бьюик"]);

  model.open();
  model.addPhotos([]);

  expect(model.isOpen()).toBe(true);

  model.addPhotos([photo]);

  expect(model.isOpen()).toBe(false);
  expect(uploaded).toEqual([[photo]]);
});
