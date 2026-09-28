import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { seedCatalog } from "../../worker/local/fixtures";
import { type Mode, type NativeInstance, ROOT, startNative } from "../../worker/local/native";

export interface LaunchOptions {
	automated: boolean;
	store?: string;
	initial?: Mode;
	dataset: "demo" | "empty";
}
export async function localGateway(options: LaunchOptions) {
	const sessions = new Map<string, { mode: Mode; native?: NativeInstance }>();
	let demo: NativeInstance | undefined;
	let queue = Promise.resolve();
	async function create(mode: Mode) {
		if (options.automated && mode !== "e2e") throw new Error("Automated E2E is locked");
		if (mode === "prod" && !process.env.SURETY_DEV_API_TOKEN)
			throw new Error("Production credentials unavailable; select Demo or E2E");
		let native: NativeInstance | undefined;
		if (mode === "demo") {
			if (!demo) {
				const candidate = await startNative("demo", options.store);
				try {
					await seedCatalog(candidate, true);
					demo = candidate;
				} catch (error) {
					await candidate.stop();
					throw error;
				}
			}
			native = demo;
		} else if (mode === "e2e") {
			native = await startNative("e2e", options.store);
			try {
				if (options.dataset === "demo") await seedCatalog(native, false);
			} catch (error) {
				await native.stop();
				throw error;
			}
		}
		const id = randomUUID();
		sessions.set(id, native ? { mode, native } : { mode });
		return id;
	}
	const lockedId = options.automated ? await create("e2e") : undefined;
	function describe(id: string) {
		const session = sessions.get(id);
		if (!session) throw new Error("Instance expired");
		return {
			id,
			mode: session.mode,
			locked: options.automated,
			visible: !process.env.CI,
			fixtureVersion: session.native?.fixtureVersion,
			schemaHash: session.native?.schemaHash,
		};
	}
	async function route(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const host = url.hostname;
		if (!["127.0.0.1", "localhost", "surety.dev.hexly.ai"].includes(host))
			return new Response("Invalid local host", { status: 403 });
		if (!["GET", "HEAD"].includes(request.method) && request.headers.get("origin") !== url.origin)
			return new Response("Same-origin request required", { status: 403 });
		if (url.pathname === "/__local/capability")
			return Response.json({
				local: true,
				locked: options.automated,
				initial: options.initial,
				visible: !process.env.CI,
			});
		if (url.pathname === "/__local/start" && request.method === "POST") {
			if (lockedId) return Response.json(describe(lockedId));
			const body = (await request.json()) as { id?: string; preference?: Mode };
			if (body.id && sessions.has(body.id)) return Response.json(describe(body.id));
			const mode =
				options.initial ??
				(["demo", "e2e", "prod"].includes(body.preference ?? "") ? body.preference : undefined) ??
				"demo";
			return Response.json(describe(await create(mode)));
		}
		if (url.pathname === "/__local/switch" && request.method === "POST") {
			if (options.automated) return new Response("Automated E2E is locked", { status: 403 });
			const { id, mode } = (await request.json()) as { id: string; mode: Mode };
			const previous = sessions.get(id);
			if (!previous) return new Response("Instance expired", { status: 410 });
			if (!["demo", "e2e", "prod"].includes(mode))
				return new Response("Invalid mode", { status: 400 });
			if (mode === previous.mode) return Response.json(describe(id));
			const next = await create(mode);
			sessions.delete(id);
			if (previous.mode === "e2e") await previous.native?.stop();
			return Response.json(describe(next));
		}
		const match = /^\/__instance\/([a-f0-9-]+)(\/api\/.*)$/.exec(url.pathname);
		const id = match?.[1] ?? (url.pathname.startsWith("/api/") ? lockedId : undefined);
		const apiPath = match?.[2] ?? url.pathname;
		const session = id ? sessions.get(id) : undefined;
		if (!session) return new Response("Instance expired; reload the application", { status: 410 });
		const headers = new Headers(request.headers);
		for (const name of [
			"host",
			"cookie",
			"cf-access-jwt-assertion",
			"x-forwarded-host",
			"x-forwarded-proto",
		])
			headers.delete(name);
		const init: RequestInit = { method: request.method, headers, redirect: "manual" };
		if (!["GET", "HEAD"].includes(request.method)) init.body = await request.arrayBuffer();
		let response: Response;
		if (session.native) {
			response = await session.native.request(apiPath + url.search, init);
		} else {
			headers.set("authorization", `Bearer ${process.env.SURETY_DEV_API_TOKEN}`);
			headers.delete("origin");
			response = await fetch(`https://surety-api.hexly.ai${apiPath}${url.search}`, init);
		}
		const outputHeaders = new Headers(response.headers);
		for (const name of ["set-cookie", "content-encoding", "content-length", "transfer-encoding"])
			outputHeaders.delete(name);
		outputHeaders.set("cache-control", "no-store");
		return new Response(response.body, { status: response.status, headers: outputHeaders });
	}
	async function middleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
		if (!/^\/(?:__local|__instance|api)\//.test(req.url ?? "")) return next();
		try {
			const chunks: Buffer[] = [];
			for await (const chunk of req) chunks.push(Buffer.from(chunk));
			const headers = new Headers();
			for (const [key, value] of Object.entries(req.headers))
				if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
			const scheme = req.headers.host === "surety.dev.hexly.ai" ? "https" : "http";
			const init: RequestInit = { method: req.method ?? "GET", headers };
			if (chunks.length) init.body = Buffer.concat(chunks);
			const request = new Request(`${scheme}://${req.headers.host}${req.url}`, init);
			let response: Response;
			if (req.url?.startsWith("/__local/")) {
				const pending = queue.then(() => route(request));
				queue = pending.then(
					() => {},
					() => {},
				);
				response = await pending;
			} else response = await route(request);
			res.writeHead(response.status, Object.fromEntries(response.headers));
			res.end(Buffer.from(await response.arrayBuffer()));
		} catch (error) {
			res.writeHead(503, { "content-type": "application/json" });
			res.end(
				JSON.stringify({ error: error instanceof Error ? error.message : "Local runtime failed" }),
			);
		}
	}
	const plugin: Plugin = {
		name: "surety-local-runtime",
		configureServer(server) {
			server.middlewares.use(middleware);
		},
		configurePreviewServer(server) {
			server.middlewares.use(middleware);
		},
	};
	async function stop() {
		for (const session of sessions.values())
			if (session.mode === "e2e") await session.native?.stop();
		sessions.clear();
		await demo?.stop();
	}
	return { plugin, stop, root: resolve(ROOT, "apps/web") };
}
