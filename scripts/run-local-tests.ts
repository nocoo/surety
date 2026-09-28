import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { cleanEnvironment, ROOT } from "../apps/worker/local/native";

const lane = process.argv[2];
if (lane !== "http" && lane !== "browser") throw new Error("Expected http or browser");
const env = cleanEnvironment();
const portProbe = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() });
const port = portProbe.port;
portProbe.stop(true);
const base = `http://127.0.0.1:${port}`;
const evidence = resolve(ROOT, "test-results", `local-${lane}-${crypto.randomUUID()}`);
await mkdir(evidence, { recursive: true });
const build = Bun.spawn(["bun", "--no-env-file", "run", "build"], {
	cwd: ROOT,
	env,
	stdout: "inherit",
	stderr: "inherit",
});
if (await build.exited) throw new Error("Build failed");
const runtime = Bun.spawn(
	[
		"bun",
		"--no-env-file",
		"apps/web/local/main.ts",
		"--automated",
		"--built",
		"--port",
		String(port),
		"--dataset",
		"empty",
	],
	{
		cwd: ROOT,
		env,
		stdout: Bun.file(resolve(evidence, "runtime.log")),
		stderr: Bun.file(resolve(evidence, "runtime.log")),
	},
);
let tests: ReturnType<typeof Bun.spawn> | undefined;
function interrupt() {
	tests?.kill("SIGTERM");
	runtime.kill("SIGTERM");
}
process.on("SIGINT", interrupt);
process.on("SIGTERM", interrupt);
try {
	let ready = false;
	for (let i = 0; i < 200; i++) {
		if (runtime.exitCode !== null) throw new Error("Local runtime exited; inspect runtime.log");
		try {
			if ((await fetch(`${base}/api/live`)).ok) {
				ready = true;
				break;
			}
		} catch {}
		await Bun.sleep(200);
	}
	if (!ready) throw new Error("Local runtime readiness timed out");
	const cmd =
		lane === "http"
			? [
					"bun",
					"--no-env-file",
					"test",
					"apps/worker/__tests__/l2-http",
					"--path-ignore-patterns",
					"__none__",
				]
			: [
					"bun",
					"--no-env-file",
					"apps/web/node_modules/@playwright/test/cli.js",
					"test",
					"--config",
					"apps/web/playwright.config.ts",
				];
	tests = Bun.spawn(cmd, {
		cwd: ROOT,
		env: {
			...env,
			L2_HTTP_BASE_URL: base,
			L3_PORT: String(port),
			SURETY_E2E_OWNED: "true",
			SURETY_TEST_OUTPUT: evidence,
		},
		stdout: "inherit",
		stderr: "inherit",
	});
	process.exitCode = await tests.exited;
} finally {
	runtime.kill("SIGTERM");
	await runtime.exited;
	console.log(`Evidence: ${evidence}`);
}
