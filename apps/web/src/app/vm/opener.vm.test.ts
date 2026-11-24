import { describe, expect, test } from "vite-plus/test";

import { targetOfLink } from "./opener.vm.ts";

describe("a deep link", () => {
  test.each([
    { startParameter: "pet_pet-1", target: { kind: "pet", petId: "pet-1" } },
    { startParameter: "entry_entry-7", target: { kind: "care-entry", entryId: "entry-7" } },
    { startParameter: "task_task-1", target: { kind: "task", taskId: "task-1" } },
    { startParameter: "goal_goal-1", target: { kind: "goal", goalId: "goal-1" } },
    { startParameter: "recipe_recipe-1", target: { kind: "recipe", recipeId: "recipe-1" } },
    { startParameter: "album_album-1", target: { kind: "album", albumId: "album-1" } },
    {
      startParameter: "rec_0199b4d2-6c00-7abc-8def-0123456789ab_2026-10-05",
      target: {
        kind: "record",
        taskId: "0199b4d2-6c00-7abc-8def-0123456789ab",
        occurrence: "2026-10-05",
      },
    },
  ])("$startParameter opens $target.kind", ({ startParameter, target }) => {
    expect(targetOfLink(startParameter)).toEqual(target);
  });

  test.each([
    { startParameter: "plan_plan-1", taskId: "plan-1" },
    { startParameter: "event_event-1", taskId: "event-1" },
  ])(
    "$startParameter from before Tasks opens the Task that kept its id",
    ({ startParameter, taskId }) => {
      expect(targetOfLink(startParameter)).toEqual({ kind: "task", taskId });
    },
  );

  test.each([
    "rec_0199b4d2-6c00-7abc-8def-0123456789ab",
    "rec_0199b4d2-6c00-7abc-8def-0123456789ab_soon",
    "inv_token-1",
    "cmd_draft-1",
    "nonsense",
    undefined,
  ])("%s opens nothing", (startParameter) => {
    expect(targetOfLink(startParameter)).toBeUndefined();
  });
});
