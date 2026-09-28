import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import { preview } from "vite";
import { INIT_SQL } from "../../../packages/db/src";
import {
	cleanEnvironment,
	fixtureVersion,
	ROOT,
	resetDemo,
	startNative,
} from "../../worker/local/native";
import { type LaunchOptions, localGateway } from "./gateway";

const run = crypto.randomUUID();
const store = resolve(ROOT, ".surety-local", `verification-${run}`);
const evidence = resolve(ROOT, "test-results", `environments-${run}`);
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch();
const launch = async (options: LaunchOptions) => {
	const gateway = await localGateway({ ...options, store });
	const server = await preview({
		root: gateway.root,
		plugins: [gateway.plugin],
		preview: { port: 0, host: "127.0.0.1" },
	});
	const address = server.httpServer.address();
	assert(address && typeof address !== "string");
	const base = `http://127.0.0.1:${address.port}`;
	const request = (path: string, body?: object) =>
		fetch(
			base + path,
			body
				? {
						method: "POST",
						headers: { origin: base, "content-type": "application/json" },
						body: JSON.stringify(body),
					}
				: {},
		);
	return {
		base,
		request,
		stop: async () => {
			await server.close();
			await gateway.stop();
		},
	};
};
for (const built of [false, true]) {
	const probe = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() });
	const port = probe.port;
	probe.stop(true);
	const base = `http://127.0.0.1:${port}`;
	const proc = Bun.spawn(
		[
			"bun",
			"--no-env-file",
			"apps/web/local/main.ts",
			"--automated",
			"--dataset",
			"empty",
			"--port",
			String(port),
			...(built ? ["--built"] : []),
		],
		{
			cwd: ROOT,
			env: cleanEnvironment(),
			stdout: Bun.file(resolve(evidence, `shutdown-${built}.log`)),
			stderr: "inherit",
		},
	);
	let resourceId: string | undefined;
	try {
		for (let attempt = 0; attempt < 200; attempt++) {
			if (proc.exitCode !== null) throw new Error("Lifecycle launcher failed");
			try {
				if ((await fetch(`${base}/api/live`)).ok) break;
			} catch {}
			await Bun.sleep(200);
		}
		const response = await fetch(`${base}/__local/start`, {
			method: "POST",
			headers: { origin: base, "content-type": "application/json" },
			body: "{}",
		});
		resourceId = ((await response.json()) as { resourceId: string }).resourceId;
		assert(resourceId);
	} finally {
		proc.kill("SIGTERM");
		await proc.exited;
	}
	assert.equal(
		await Bun.file(resolve(ROOT, ".surety-local/runs", resourceId, "owner.json")).exists(),
		false,
	);
	console.log(`PASS ${built ? "built" : "dev"} SIGTERM removes owned resources`);
}
const checks: string[] = [];
const revision = await new Response(
	Bun.spawn(["git", "rev-parse", "HEAD"], { cwd: ROOT, stdout: "pipe" }).stdout,
).text();
function pass(name: string) {
	checks.push(name);
	console.log(`PASS ${name}`);
}
const native = await startNative("e2e", store);
try {
	assert.equal((await fetch(`${native.target}/api/members`)).status, 401);
	assert.equal(
		(await native.request("/api/members", { headers: { "Cf-Access-Jwt-Assertion": "forged" } }))
			.status,
		403,
	);
	const minted = await native.request(
		"/api/auth/cli?callback_url=http%3A%2F%2Flocalhost%3A43210%2Fcallback&state=verification",
		{
			headers: {
				"sec-fetch-mode": "navigate",
				"sec-fetch-dest": "document",
				"sec-fetch-site": "none",
			},
		},
	);
	assert.equal(minted.status, 302);
	const token = new URL(minted.headers.get("location") as string).searchParams.get("api_key");
	assert(token);
	const headers = { authorization: `Bearer ${token}` };
	assert.equal((await native.request("/api/members", { headers })).status, 200);
	assert.equal((await native.request("/api/auth/tokens", { headers })).status, 401);
	const cli = Bun.spawn(["bun", "--no-env-file", "apps/cli/src/index.ts", "members", "ls"], {
		cwd: ROOT,
		env: { ...cleanEnvironment(), SURETY_API_URL: native.target, SURETY_API_TOKEN: token },
		stdout: "pipe",
		stderr: "pipe",
	});
	assert.equal(await cli.exited, 0);
	const creation = await native.request("/api/members", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ name: "Isolated fixture", relation: "Self" }),
	});
	assert.equal(creation.status, 201);
	const other = await startNative("e2e", store);
	try {
		assert.equal((await other.request("/api/members", { headers })).status, 403);
		assert.deepEqual(await (await other.request("/api/members")).json(), []);
	} finally {
		await other.stop();
	}
	const tokens = (await (await native.request("/api/auth/tokens")).json()) as { id: number }[];
	assert.equal(
		(await native.request(`/api/auth/tokens/${tokens[0]?.id}`, { method: "DELETE" })).status,
		200,
	);
	assert.equal((await native.request("/api/members", { headers })).status, 403);
	pass(
		"native JWT rejection, token issuance, bearer permissions, cross-run rejection and revocation",
	);
	assert.equal(
		(await readFile(resolve(ROOT, "apps/worker/migrations/0001_initial.sql"), "utf8")).trim(),
		INIT_SQL.trim(),
	);
	const source = Bun.TOML.parse(
		await readFile(resolve(ROOT, "apps/worker/wrangler.toml"), "utf8"),
	) as { compatibility_date: string; compatibility_flags: string[] };
	assert.equal(native.config.compatibility_date, source.compatibility_date);
	assert.deepEqual(native.config.compatibility_flags, source.compatibility_flags);
	pass("migration and runtime parity");
} finally {
	await native.stop();
}
let runtime = await launch({ automated: false, dataset: "demo" });
try {
	const context = await browser.newContext({
		viewport: { width: 1440, height: 1000 },
		locale: "zh-CN",
		timezoneId: "Asia/Shanghai",
	});
	const page = await context.newPage();
	await page.goto(runtime.base);
	const demo = page.getByRole("radio", { name: "Demo", exact: true });
	await expect(demo).toBeChecked({ timeout: 60000 });
	const id = () => page.evaluate(() => sessionStorage.getItem("surety:environment-instance"));
	const first = await id();
	const second = await context.newPage();
	await second.goto(runtime.base);
	await expect(second.getByRole("radio", { name: "Demo", exact: true })).toBeChecked({
		timeout: 30000,
	});
	const secondId = await second.evaluate(() =>
		sessionStorage.getItem("surety:environment-instance"),
	);
	const members = (await (
		await runtime.request(`/__instance/${first}/api/members`)
	).json()) as unknown[];
	assert.equal(members.length, 4);
	await page.screenshot({ path: resolve(evidence, "dashboard-desktop.png"), fullPage: true });
	await page.goto(`${runtime.base}/policies/1`);
	await expect(page.getByText("安心住院医疗", { exact: true }).first()).toBeVisible();
	await page.screenshot({ path: resolve(evidence, "policy-desktop.png"), fullPage: true });
	const attachments = (await (
		await runtime.request(`/__instance/${first}/api/policies/1/attachments`)
	).json()) as { id: number }[];
	assert.equal(attachments.length, 2);
	for (const attachment of attachments)
		assert.equal(
			(
				await runtime.request(
					`/__instance/${first}/api/policies/1/attachments/${attachment.id}/file`,
				)
			).status,
			200,
		);
	await page.goto(`${runtime.base}/settings`);
	await expect(page.getByLabel("家庭年收入 (元)")).toHaveValue("480000");
	await page.getByLabel("家庭年收入 (元)").fill("480001");
	page.once("dialog", (dialog) => dialog.dismiss());
	await page.getByRole("radio", { name: "E2E", exact: true }).click();
	assert.equal(await id(), first);
	await expect(demo).toBeChecked();
	assert.equal(await page.evaluate(() => localStorage.getItem("surety:environment-mode")), null);
	pass("default Demo, rich fixtures, media, cancelled draft preserves instance and preference");
	let pendingWrite: ReturnType<typeof httpRequest> | undefined;
	const pendingStatus = new Promise<number | undefined>((resolveStatus, reject) => {
		pendingWrite = httpRequest(
			`${runtime.base}/__instance/${first}/api/members`,
			{ method: "POST", headers: { origin: runtime.base, "content-type": "application/json" } },
			(response) => {
				response.resume();
				resolveStatus(response.statusCode);
			},
		);
		pendingWrite.on("error", reject);
		pendingWrite.write('{"name":');
	});
	page.once("dialog", (dialog) => dialog.accept());
	await page.getByRole("radio", { name: "E2E", exact: true }).click();
	await expect(page.getByRole("radio", { name: "E2E", exact: true })).toBeChecked({
		timeout: 60000,
	});
	const e2e = await id();
	pendingWrite?.end('"Late fixture", "relation":"Self"}');
	assert.equal(await pendingStatus, 410);
	assert.notEqual(e2e, first);
	assert.equal((await runtime.request(`/__instance/${first}/api/members`)).status, 410);
	assert.equal((await runtime.request(`/__instance/${secondId}/api/members`)).status, 200);
	await page.getByRole("radio", { name: "Demo", exact: true }).click();
	await expect(demo).toBeChecked({ timeout: 30000 });
	assert.equal((await runtime.request(`/__instance/${e2e}/api/members`)).status, 410);
	await page.getByRole("radio", { name: "E2E", exact: true }).click();
	await expect(page.getByRole("radio", { name: "E2E", exact: true })).toBeChecked({
		timeout: 60000,
	});
	assert.notEqual(await id(), e2e);
	pass("accepted manual E2E, fresh reentry, stale 410 and independent tab");
	await assert.rejects(resetDemo(store), /Stop the Demo/);
	await assert.rejects(resetDemo("/tmp/surety-foreign"), /Foreign storage root/);
	const marker = resolve(store, "demo/owner.json");
	const owner = await readFile(marker, "utf8");
	try {
		await writeFile(marker, "{}");
		await assert.rejects(resetDemo(store), /Invalid storage marker/);
	} finally {
		await writeFile(marker, owner);
	}
	pass("active Demo reset, foreign path and ownership mismatch refused");
	await context.close();
	const unavailable = await browser.newContext();
	await unavailable.addInitScript(() => {
		Object.defineProperty(window, "localStorage", {
			get() {
				throw new Error("Storage unavailable");
			},
		});
		Object.defineProperty(window, "sessionStorage", {
			get() {
				throw new Error("Storage unavailable");
			},
		});
	});
	const limited = await unavailable.newPage();
	await limited.goto(runtime.base);
	await expect(limited.getByRole("radio", { name: "Demo", exact: true })).toBeChecked({
		timeout: 30000,
	});
	await limited.getByRole("radio", { name: "E2E", exact: true }).click();
	await expect(limited.getByRole("radio", { name: "E2E", exact: true })).toBeChecked({
		timeout: 60000,
	});
	await unavailable.close();
	pass("in-flight old write rejected; storage-unavailable interactive switching");
	await runtime.stop();
	runtime = await launch({ automated: false, dataset: "empty", initial: "e2e" });
	const explicit = await (await runtime.request("/__local/start", { preference: "demo" })).json();
	assert.equal(explicit.mode, "e2e");
	assert.equal(explicit.locked, false);
	assert.equal(
		(await runtime.request("/__local/switch", { id: explicit.id, mode: "demo" })).status,
		200,
	);
	pass("explicit interactive E2E can exit and Demo persists after restart");
	await runtime.stop();
	runtime = await launch({ automated: false, dataset: "empty" });
	const saved = await (await runtime.request("/__local/start", { preference: "e2e" })).json();
	assert.equal(saved.mode, "e2e");
	assert.equal(saved.locked, false);
	assert.notEqual(saved.id, explicit.id);
	pass("remembered E2E starts fresh and unlocked");
	await runtime.stop();
	runtime = await launch({ automated: true, dataset: "demo" });
	const locked = await (await runtime.request("/__local/start", { preference: "prod" })).json();
	assert.equal(locked.mode, "e2e");
	assert.equal(locked.locked, true);
	assert.equal(
		(await runtime.request("/__local/switch", { id: locked.id, mode: "demo" })).status,
		403,
	);
	const capture = await browser.newContext({
		viewport: { width: 390, height: 844 },
		locale: "zh-CN",
		timezoneId: "Asia/Shanghai",
	});
	await capture.addInitScript(() => localStorage.setItem("surety:environment-mode", "prod"));
	const mobile = await capture.newPage();
	await mobile.goto(runtime.base);
	await expect(mobile.getByRole("radio", { name: "E2E", exact: true })).toBeChecked({
		timeout: 30000,
	});
	await expect(mobile.getByRole("radio", { name: "Demo", exact: true })).toBeDisabled();
	assert.equal(
		await mobile.evaluate(() => localStorage.getItem("surety:environment-mode")),
		"prod",
	);
	await mobile.screenshot({ path: resolve(evidence, "dashboard-mobile.png"), fullPage: true });
	await capture.close();
	pass("automation server lock, disabled UI, preferences untouched, mobile capture");
	const desktop = await browser.newContext({
		viewport: { width: 1440, height: 1000 },
		locale: "zh-CN",
		timezoneId: "Asia/Shanghai",
		reducedMotion: "reduce",
	});
	const screen = await desktop.newPage();
	await screen.clock.setFixedTime(new Date("2026-09-28T04:00:00+08:00"));
	for (const route of [
		"",
		"members",
		"policies",
		"policies/1",
		"insurers",
		"assets",
		"hospitals",
		"doctors",
		"medical-visits",
		"coverage-lookup",
		"renewal-calendar",
		"settings",
		"cli",
	]) {
		await screen.goto(`${runtime.base}/${route}`);
		await expect(screen.getByRole("radio", { name: "E2E", exact: true })).toBeChecked();
		await screen.waitForLoadState("networkidle");
		await screen.screenshot({
			path: resolve(evidence, `${route.replaceAll("/", "-") || "dashboard"}-capture.png`),
			fullPage: true,
		});
	}
	await screen.goto(`${runtime.base}/policies/1`);
	await screen
		.locator("li")
		.filter({ hasText: "family-protection.png" })
		.getByTitle("预览")
		.click();
	const artwork = screen.getByRole("dialog").locator("img");
	await expect(artwork).toBeVisible();
	await screen.waitForTimeout(400);
	await expect
		.poll(() => artwork.evaluate((element) => (element as HTMLImageElement).naturalWidth))
		.toBe(960);
	await screen.screenshot({ path: resolve(evidence, "attachment-preview.png") });
	await desktop.close();
	const prefix = `/__instance/${locked.id}`;
	assert.equal((await runtime.request(`${prefix}/api/settings/backy/push`, {})).status, 200);
	const setupFailure = await fetch(`${runtime.base}${prefix}/api/settings/backy`, {
		method: "PUT",
		headers: { origin: runtime.base, "content-type": "application/json" },
		body: JSON.stringify({
			webhookUrl: "https://backy.example.invalid/webhook/failure",
			apiKey: "synthetic-demo-provider",
		}),
	});
	assert.equal(setupFailure.status, 200);
	assert.equal((await runtime.request(`${prefix}/api/settings/backy/push`, {})).status, 502);
	pass("all routes captured in disposable rich E2E; external backup success and failure");
	process.env.CI = "true";
	assert.equal((await (await runtime.request("/__local/capability")).json()).visible, false);
	delete process.env.CI;
	const hosted = await preview({
		root: resolve(ROOT, "apps/web"),
		preview: { port: 0, host: "127.0.0.1" },
	});
	try {
		const address = hosted.httpServer.address();
		assert(address && typeof address !== "string");
		const context = await browser.newContext();
		await context.addInitScript(() => localStorage.setItem("surety:environment-mode", "e2e"));
		const page = await context.newPage();
		await page.goto(`http://127.0.0.1:${address.port}`);
		await expect(page.getByRole("radio", { name: "E2E", exact: true })).toHaveCount(0);
		await context.close();
	} finally {
		await hosted.close();
	}
	pass("CI capability hidden and hosted bundle ignores local preference");
} finally {
	await runtime.stop();
	await browser.close();
	await resetDemo(store);
	// Every child runtime validates its marker before deletion; only remove an empty parent.
	const { rmdir } = await import("node:fs/promises");
	await rmdir(resolve(store, "runs"));
	await rmdir(store);
	await writeFile(
		resolve(evidence, "manifest.json"),
		JSON.stringify(
			{
				revision: revision.trim(),
				appVersion: "2.3.6",
				fixtureVersion,
				anchor: "2026-09-28",
				timezone: "Asia/Shanghai",
				locale: "zh-CN",
				checks,
				viewports: [
					[1440, 1000],
					[390, 844],
				],
				production: "not accessed",
			},
			null,
			2,
		),
	);
	console.log(`Evidence: ${evidence}`);
}
