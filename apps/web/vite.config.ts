import { copyFile } from "node:fs/promises";
import { join } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite-plus";

// GitHub Pages serves 404.html for unknown paths, so a reload on a deep route still boots the SPA.
function pagesSpaFallback(): Plugin {
  return {
    name: "pages-spa-fallback",
    apply: "build",
    async writeBundle({ dir }) {
      if (dir === undefined) {
        return;
      }

      await copyFile(join(dir, "index.html"), join(dir, "404.html"));
    },
  };
}

export default defineConfig({
  base: "/family-hub/",
  plugins: [react(), pagesSpaFallback()],
  resolve: { tsconfigPaths: true },
});
