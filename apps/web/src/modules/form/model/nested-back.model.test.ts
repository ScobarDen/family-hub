import { context } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { fakeHaptics, fakeWindow } from "@/modules/telegram";

import { firstNestedBack, reatomNestedBack } from "./nested-back.model.ts";

function startForm(answers: Array<string | undefined>) {
  const frame = fakeWindow();
  const asked: string[] = [];
  let isFormOpen = true;
  const nested = reatomNestedBack({
    name: "test.notes.back",
    telegram: {
      ...frame,
      haptics: fakeHaptics(),
      showPopup: async ({ title }) => {
        asked.push(title ?? "");

        return answers.shift();
      },
    },
    canGoBack: () => isFormOpen,
    closesInPlace: () => isFormOpen,
    back: () => {
      isFormOpen = false;
    },
  });

  return {
    nested,
    asked,
    isFormOpen: () => isFormOpen,
    type: () => {
      frame.enableClosingConfirmation();
    },
  };
}

function startScreens(open: { care: boolean; pets: boolean }) {
  const closed: string[] = [];
  const telegram = { ...fakeWindow(), haptics: fakeHaptics(), showPopup: async () => "cancel" };

  function screen(name: "care" | "pets") {
    return reatomNestedBack({
      name: `test.${name}.back`,
      telegram,
      canGoBack: () => open[name],
      closesInPlace: () => name === "care",
      back: () => {
        open[name] = false;
        closed.push(name);
      },
    });
  }

  return { nested: firstNestedBack(screen("care"), screen("pets")), closed };
}

beforeEach(() => {
  context.reset();
});

describe("closing a form", () => {
  test("closes one with nothing typed at once", () => {
    const { nested, asked, isFormOpen } = startForm([]);

    nested.back();

    expect(isFormOpen()).toBe(false);
    expect(asked).toEqual([]);
  });

  test("asks before dropping unsaved input and stays open when the Member keeps it", async () => {
    const { nested, asked, isFormOpen, type } = startForm([undefined]);

    type();
    nested.back();

    await vi.waitFor(() => {
      expect(asked).toEqual(["Отменить изменения?"]);
    });
    expect(isFormOpen()).toBe(true);
  });

  test("closes once the Member agrees to drop unsaved input", async () => {
    const { nested, isFormOpen, type } = startForm(["confirm"]);

    type();
    nested.back();

    await vi.waitFor(() => {
      expect(isFormOpen()).toBe(false);
    });
  });
});

describe("screens stacked in one tab", () => {
  test("step back through the upper one first", () => {
    const { nested, closed } = startScreens({ care: true, pets: true });

    expect(nested.closesInPlace()).toBe(true);

    nested.back();

    expect(closed).toEqual(["care"]);
    expect(nested.closesInPlace()).toBe(false);
  });

  test("leave nothing to step back once both are closed", () => {
    const { nested } = startScreens({ care: false, pets: false });

    expect(nested.canGoBack()).toBe(false);
  });
});
