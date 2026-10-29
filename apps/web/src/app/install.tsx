import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { reatomBrowserPlatform } from "@/modules/browser-platform";
import { InstallPage, reatomInstallPage } from "@/modules/install-app";

const root = document.getElementById("root");

if (!root) {
  throw new Error("#root is missing from install.html");
}

const page = reatomInstallPage({
  platform: reatomBrowserPlatform(window),
  appUrl: new URL(import.meta.env.BASE_URL, window.location.origin).href,
});

const darkScheme = window.matchMedia("(prefers-color-scheme: dark)");

function followColorScheme() {
  document.documentElement.classList.toggle("dark", darkScheme.matches);
}

followColorScheme();
darkScheme.addEventListener("change", followColorScheme);

page.start();

createRoot(root).render(
  <StrictMode>
    <InstallPage model={page} />
  </StrictMode>,
);
