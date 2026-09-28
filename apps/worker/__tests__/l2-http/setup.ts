/**
 * L2-HTTP shared setup — every test in this directory hits a real
 * `wrangler dev` server over the loopback. The runner script
 * (`scripts/run-l2-http.ts`) starts/stops the server and exposes its
 * base URL via `L2_HTTP_BASE_URL`.
 */

if (process.env.SURETY_E2E_OWNED !== "true" || !process.env.L2_HTTP_BASE_URL)
	throw new Error("Use the owned E2E runner");
export const BASE_URL = process.env.L2_HTTP_BASE_URL;

export interface HttpResponse<T = unknown> {
	status: number;
	body: T;
	headers: Headers;
}

export async function httpJson<T = unknown>(
	method: string,
	path: string,
	body?: unknown,
	init: RequestInit = {},
): Promise<HttpResponse<T>> {
	const headers = new Headers(init.headers ?? {});
	headers.set("accept", "application/json");
	headers.set("origin", BASE_URL);
	let payload: BodyInit | undefined;
	if (body !== undefined) {
		headers.set("content-type", "application/json");
		payload = JSON.stringify(body);
	}
	const res = await fetch(`${BASE_URL}${path}`, {
		...init,
		method,
		headers,
		body: payload ?? init.body,
	});
	const text = await res.text();
	let parsed: unknown = text;
	if (text.length > 0) {
		try {
			parsed = JSON.parse(text);
		} catch {
			// leave as text
		}
	}
	return {
		status: res.status,
		body: parsed as T,
		headers: res.headers,
	};
}
