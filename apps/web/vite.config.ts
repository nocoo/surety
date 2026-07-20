import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
	// Prefer monorepo root `.env` (docs + shared with CLI tooling); fall back
	// to apps/web for any package-local overrides.
	const monorepoRoot = resolve(__dirname, "../..");
	const env = {
		...loadEnv(mode, monorepoRoot, ""),
		...loadEnv(mode, process.cwd(), ""),
	};
	const target = env.SURETY_API_URL ?? "https://surety-api.hexly.ai";
	const devToken = env.SURETY_DEV_API_TOKEN ?? "";

	return {
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
			allowedHosts: ["surety.dev.hexly.ai"],
			proxy: {
				"/api": {
					target,
					changeOrigin: true,
					configure: (proxy) => {
						proxy.on("proxyReq", (proxyReq) => {
							if (devToken && !proxyReq.getHeader("authorization")) {
								proxyReq.setHeader("authorization", `Bearer ${devToken}`);
							}
						});
					},
				},
			},
		},
	};
});
