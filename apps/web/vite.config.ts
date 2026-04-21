import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "../worker/static",
    emptyOutDir: true,
  },
  server: {
    port: 7012,
    proxy: {
      "/api": {
        target: "http://localhost:7016",
        changeOrigin: true,
      },
    },
  },
});
