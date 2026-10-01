import { defineConfig } from "vite";

export default defineConfig({
  // Base relativa para poder desplegar en cualquier subcarpeta
  // (GitHub Pages, Netlify, hosting compartido, etc.)
  base: "./",
  build: {
    outDir: "dist",
    assetsInlineLimit: 0,
  },
});
