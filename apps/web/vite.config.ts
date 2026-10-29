import { copyFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
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
  plugins: [react(), tailwindcss(), pagesSpaFallback()],
  // The install page boots none of the app: it only offers to install it.
  build: {
    rollupOptions: {
      input: {
        app: fileURLToPath(new URL("index.html", import.meta.url)),
        install: fileURLToPath(new URL("install.html", import.meta.url)),
      },
    },
  },
  resolve: { tsconfigPaths: true },
  server: {
    // The dev bot opens the Mini App through a cloudflared quick tunnel, so the Worker sits behind the same origin.
    allowedHosts: [".trycloudflare.com"],
    proxy: {
      "/api": "http://localhost:8787",
      "/bot": "http://localhost:8787",
    },
  },
});
