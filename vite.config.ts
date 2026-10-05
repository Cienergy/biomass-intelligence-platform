import react from "@vitejs/plugin-react";
import { cpSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const root = dirname(fileURLToPath(import.meta.url));

/** Copy MapLibre worker + shared module so relative imports resolve under BASE_URL. */
function copyMaplibreWorker(): Plugin {
  const copy = () => {
    const dest = resolve(root, "public/maplibre");
    const src = resolve(root, "node_modules/maplibre-gl/dist");
    mkdirSync(dest, { recursive: true });
    for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
      cpSync(resolve(src, file), resolve(dest, file));
    }
  };
  return {
    name: "copy-maplibre-worker",
    buildStart: copy,
    configureServer: copy,
  };
}

export default defineConfig({
  plugins: [react(), copyMaplibreWorker()],
  base: process.env.VITE_BASE || "/",
});
