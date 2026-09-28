import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(() => {
	return {
		plugins: [react(), tailwindcss()],
		resolve: {
			alias: {
				"@": resolve(import.meta.dirname, "./src"),
			},
		},
		build: {
			outDir: "../worker/static",
			emptyOutDir: true,
		},
		server: {
			port: 7012,
			allowedHosts: ["surety.dev.hexly.ai"],
		},
	};
});
