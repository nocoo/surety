/**
 * Smoke tests for the Vite SPA fetch wrapper.
 *
 * fetchAPI is the single entry point used by every SWR hook in the app, so
 * misbehavior here fan-outs everywhere. We cover: credentials are included
 * (CF Access cookie delivery), success parsing, and error-body extraction.
 */
import { afterEach, describe, expect, test } from "vitest";
import { fetchAPI } from "../api";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("fetchAPI", () => {
	test("forwards credentials: 'include' on every request", async () => {
		let seenInit: RequestInit | undefined;
		globalThis.fetch = (async (_input: URL | string | Request, init?: RequestInit) => {
			seenInit = init;
			return new Response(JSON.stringify({ ok: true }), { status: 200 });
		}) as typeof fetch;
		await fetchAPI<{ ok: boolean }>("/api/ping");
		expect(seenInit?.credentials).toBe("include");
	});

	test("parses JSON on 2xx", async () => {
		globalThis.fetch = (async () =>
			new Response(JSON.stringify({ id: 1 }), {
				status: 200,
				headers: { "content-type": "application/json" },
			})) as unknown as typeof fetch;
		const out = await fetchAPI<{ id: number }>("/api/members/1");
		expect(out).toEqual({ id: 1 });
	});

	test("throws server error.message on non-2xx JSON body", async () => {
		globalThis.fetch = (async () =>
			new Response(JSON.stringify({ error: "nope" }), {
				status: 403,
				headers: { "content-type": "application/json" },
			})) as unknown as typeof fetch;
		await expect(fetchAPI("/api/forbidden")).rejects.toThrow("nope");
	});

	test("falls back to HTTP N when body is not JSON", async () => {
		globalThis.fetch = (async () =>
			new Response("oops", { status: 502 })) as unknown as typeof fetch;
		await expect(fetchAPI("/api/broken")).rejects.toThrow("HTTP 502");
	});

	test("falls back to HTTP N when JSON body has no error field", async () => {
		globalThis.fetch = (async () =>
			new Response(JSON.stringify({ message: "denied" }), {
				status: 403,
				headers: { "content-type": "application/json" },
			})) as unknown as typeof fetch;
		await expect(fetchAPI("/api/forbidden")).rejects.toThrow("HTTP 403");
	});
});
