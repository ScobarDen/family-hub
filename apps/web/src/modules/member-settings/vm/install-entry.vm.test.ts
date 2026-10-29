import { context } from "@reatom/core";
import { beforeEach, expect, test } from "vite-plus/test";

import { reatomInstallEntry } from "./install-entry.vm.ts";

const installUrl = "https://scobarden.github.io/family-hub/install.html";

function entryIn({ isInTelegram }: { isInTelegram: boolean }) {
  const opened: string[] = [];
  const model = reatomInstallEntry({
    telegram: {
      isInTelegram,
      openLink: (url) => {
        opened.push(url);
      },
    },
    installUrl,
  });

  return { model, opened };
}

beforeEach(() => {
  context.reset();
});

test("opens the install page in the device's own browser", () => {
  const { model, opened } = entryIn({ isInTelegram: true });

  model.open();

  expect(model.isShown).toBe(true);
  expect(opened).toEqual([installUrl]);
});

test("is not offered inside the Installed App itself", () => {
  expect(entryIn({ isInTelegram: false }).model.isShown).toBe(false);
});
