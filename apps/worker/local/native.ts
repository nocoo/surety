import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

export const ROOT = resolve(import.meta.dirname, "../../..");
const STORE = resolve(ROOT, ".surety-local");
const WORKER = resolve(ROOT, "apps/worker");
const WRANGLER = resolve(WORKER, "node_modules/wrangler/bin/wrangler.js");
export const fixtureVersion = "2026-09-28.1";
export type Mode = "demo" | "e2e" | "prod";

export function cleanEnvironment(): Record<string, string> {
	const env: Record<string, string> = {};
	for (const key of ["PATH", "HOME", "TMPDIR", "LANG", "CI"]) {
		if (process.env[key]) env[key] = process.env[key] as string;
	}
	return {
		...env,
		NODE_ENV: "test",
		WRANGLER_SEND_METRICS: "false",
		CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
	};
}

async function own(path: string, create: boolean) {
	await mkdir(STORE, { recursive: true });
	const canonicalStore = await realpath(STORE);
	if (canonicalStore !== STORE || !path.startsWith(`${STORE}/`))
		throw new Error("Foreign storage root");
	if (create) await mkdir(path, { recursive: false });
	if ((await realpath(path)) !== path || (await stat(path)).uid !== process.getuid?.())
		throw new Error("Foreign storage owner");
	const marker = resolve(path, "owner.json");
	if (create)
		await writeFile(marker, JSON.stringify({ app: "surety", root: ROOT, path }), { mode: 0o600 });
	const record = JSON.parse(await readFile(marker, "utf8"));
	if (record.app !== "surety" || record.root !== ROOT || record.path !== path)
		throw new Error("Invalid storage marker");
}

export async function resetDemo(store = STORE) {
	const path = resolve(store, "demo");
	await own(path, false);
	if (await Bun.file(resolve(path, "active.lock")).exists())
		throw new Error("Stop the Demo launcher before resetting its data");
	await rm(path, { recursive: true });
}

async function command(args: string[], cwd: string) {
	const proc = Bun.spawn(["node", WRANGLER, ...args], {
		cwd,
		env: cleanEnvironment(),
		stdout: "pipe",
		stderr: "pipe",
	});
	const [out, err, code] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	if (code) throw new Error(`Wrangler failed: ${out}\n${err}`);
}

export async function startNative(mode: "demo" | "e2e", store = STORE) {
	if (store !== STORE && !store.startsWith(`${STORE}/`)) throw new Error("Foreign storage root");
	const id = randomUUID();
	const path = resolve(store, mode === "demo" ? "demo" : `runs/${id}`);
	await mkdir(resolve(store, "runs"), { recursive: true });
	const exists = await Bun.file(resolve(path, "owner.json")).exists();
	await own(path, !exists);
	const lock = resolve(path, "active.lock");
	await writeFile(lock, String(process.pid), { flag: "wx", mode: 0o600 });
	const configDir = resolve(STORE, `runtime-${id}`);
	await own(configDir, true);
	const boundary = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		fetch(request) {
			const url = new URL(request.url);
			if (url.pathname === "/api/authors/profile")
				return Response.json({
					name: "云杉示范家庭",
					avatar:
						"data:image/svg+xml," +
						encodeURIComponent(
							'<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="48" fill="#dce9dc"/><path d="M48 16 20 64h20v16h16V64h20Z" fill="#37634c"/></svg>',
						),
				});
			if (url.pathname === "/webhook/failure")
				return Response.json({ error: "Synthetic provider unavailable" }, { status: 503 });
			if (url.pathname === "/webhook")
				return Response.json(
					request.method === "GET"
						? {
								project_name: "Surety Demo",
								environment: "demo",
								total_backups: 1,
								recent_backups: [
									{
										id: "fixture-1",
										tag: "Synthetic family catalog",
										environment: "demo",
										file_size: 18432,
										is_single_json: 1,
										created_at: "2026-09-28T00:00:00Z",
									},
								],
							}
						: { id: "demo-backup", success: true },
				);
			return new Response("Unknown fixture boundary", { status: 404 });
		},
	});
	const { privateKey, publicKey } = await generateKeyPair("RS256");
	const jwk = await exportJWK(publicKey);
	const source = Bun.TOML.parse(await readFile(resolve(WORKER, "wrangler.toml"), "utf8")) as {
		compatibility_date: string;
		compatibility_flags: string[];
	};
	const config = {
		name: "surety-local",
		main: resolve(WORKER, "src/index.ts"),
		compatibility_date: source.compatibility_date,
		compatibility_flags: source.compatibility_flags,
		alias: { "bun:sqlite": resolve(WORKER, "src/lib/bun-sqlite-stub.ts") },
		assets: {
			directory: resolve(WORKER, "static"),
			binding: "ASSETS",
			run_worker_first: ["/api/*"],
			not_found_handling: "single-page-application",
		},
		d1_databases: [
			{
				binding: "DB",
				database_name: "surety-local",
				database_id: "00000000-0000-0000-0000-000000000001",
				migrations_dir: resolve(WORKER, "migrations"),
			},
		],
		r2_buckets: [{ binding: "ATTACHMENTS", bucket_name: "surety-local" }],
		vars: {
			ENVIRONMENT: "local",
			LOCAL_EXTERNAL_ORIGIN: `http://127.0.0.1:${boundary.port}`,
			LOCAL_ACCESS_JWKS: JSON.stringify({ keys: [jwk] }),
			CF_ACCESS_TEAM_DOMAIN: "surety-fixture.invalid",
			CF_ACCESS_AUD: id,
		},
	};
	const configPath = resolve(configDir, "wrangler.json");
	await writeFile(configPath, JSON.stringify(config), { mode: 0o600 });
	let proc: ReturnType<typeof Bun.spawn> | undefined;
	let stopped = false;
	async function stop() {
		if (stopped) return;
		stopped = true;
		boundary.stop(true);
		if (proc) {
			proc.kill();
			await proc.exited;
		}
		await own(path, false);
		await rm(lock, { force: true });
		if (mode === "e2e") await rm(path, { recursive: true });
		await own(configDir, false);
		await rm(configDir, { recursive: true });
	}
	try {
		await command(
			[
				"d1",
				"migrations",
				"apply",
				"surety-local",
				"--local",
				"--persist-to",
				path,
				"--config",
				configPath,
			],
			configDir,
		);
		const probe = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => new Response() });
		const port = probe.port;
		probe.stop(true);
		const log = Bun.file(resolve(configDir, "worker.log"));
		proc = Bun.spawn(
			[
				"node",
				WRANGLER,
				"dev",
				"--local",
				"--config",
				configPath,
				"--persist-to",
				path,
				"--port",
				String(port),
				"--ip",
				"127.0.0.1",
				"--inspector-port",
				"0",
			],
			{ cwd: configDir, env: cleanEnvironment(), stdout: log, stderr: log },
		);
		const target = `http://127.0.0.1:${port}`;
		let ready = false;
		for (let i = 0; i < 150; i++) {
			if (proc.exitCode !== null) throw new Error(await log.text());
			try {
				if ((await fetch(`${target}/api/live`)).ok) {
					ready = true;
					break;
				}
			} catch {}
			await Bun.sleep(200);
		}
		if (!ready) throw new Error(`Worker startup timed out: ${await log.text()}`);
		async function request(pathname: string, init: RequestInit = {}) {
			const headers = new Headers(init.headers);
			if (!headers.has("authorization") && !headers.has("Cf-Access-Jwt-Assertion")) {
				const jwt = await new SignJWT({
					email: mode === "demo" ? "demo@example.invalid" : `e2e-${id}@example.invalid`,
				})
					.setProtectedHeader({ alg: "RS256" })
					.setIssuer("https://surety-fixture.invalid")
					.setAudience(id)
					.setIssuedAt()
					.setExpirationTime("1h")
					.sign(privateKey);
				headers.set("Cf-Access-Jwt-Assertion", jwt);
			}
			headers.set("origin", target);
			return fetch(`${target}${pathname}`, { ...init, headers, redirect: "manual" });
		}
		async function seedSql(sql: string) {
			await own(path, false);
			const file = resolve(configDir, "fixture.sql");
			await writeFile(file, sql);
			await command(
				[
					"d1",
					"execute",
					"surety-local",
					"--local",
					"--persist-to",
					path,
					"--config",
					configPath,
					"--file",
					file,
				],
				configDir,
			);
		}
		return {
			seedSql,
			id,
			mode,
			path,
			target,
			request,
			stop,
			config,
			fixtureVersion,
			schemaHash: createHash("sha256")
				.update(await readFile(resolve(WORKER, "migrations/0001_initial.sql")))
				.digest("hex"),
		};
	} catch (error) {
		await stop();
		throw error;
	}
}
export type NativeInstance = Awaited<ReturnType<typeof startNative>>;
