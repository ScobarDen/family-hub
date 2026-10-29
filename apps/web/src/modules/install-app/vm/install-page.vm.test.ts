import { context } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { fakeBrowserPlatform } from "@/modules/browser-platform";

import { reatomInstallPage } from "./install-page.vm.ts";

const appUrl = "https://scobarden.github.io/family-hub/";

function startPage(options: Parameters<typeof fakeBrowserPlatform>[0] = {}) {
  const browser = fakeBrowserPlatform(options);
  const model = reatomInstallPage({ platform: browser.platform, appUrl });

  model.start();

  return { model, browser };
}

beforeEach(() => {
  context.reset();
});

describe("the install page", () => {
  test("offers the browser's own install prompt once it comes", () => {
    const { model, browser } = startPage();

    browser.offerInstall();

    expect(model.screen()).toEqual({ kind: "prompt" });
  });

  test("offers to open the app once it is installed", async () => {
    const { model, browser } = startPage();

    browser.offerInstall();
    model.install();
    await vi.waitFor(() => {
      expect(model.screen()).toEqual({ kind: "installed" });
    });
    model.openApp();

    expect(browser.visited).toEqual([appUrl]);
  });

  test("shows the steps on iOS, where Safari has no prompt", () => {
    expect(startPage({ isIos: true }).model.screen()).toEqual({ kind: "ios-steps" });
  });

  test("says plainly when the browser cannot install apps", () => {
    expect(startPage().model.screen()).toEqual({ kind: "unsupported" });
  });

  test("goes straight into an app that is already installed", () => {
    const { model, browser } = startPage({ isStandalone: true });

    expect(model.screen()).toEqual({ kind: "opening" });
    expect(browser.visited).toEqual([appUrl]);
  });
});
