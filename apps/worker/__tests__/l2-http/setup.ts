/**
 * L2-HTTP shared setup — every test in this directory hits a real
 * `wrangler dev` server over the loopback. The runner script
 * (`scripts/run-l2-http.ts`) starts/stops the server and exposes its
 * base URL via `L2_HTTP_BASE_URL`.
 */

export const BASE_URL =
  process.env.L2_HTTP_BASE_URL ?? "http://127.0.0.1:7017";

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

/**
 * Wipe the named tables. Order matters for FK-constrained schemas — pass
 * leaf tables before parents (e.g. `attachments` before `policies`).
 */
export async function reset(tables: readonly string[]): Promise<void> {
  for (const t of tables) {
    const res = await httpJson("POST", "/api/__test__/reset", { table: t });
    // 404 is acceptable in environments where the reset route is absent;
    // we fall back to ad-hoc deletes per suite.
    if (res.status !== 200 && res.status !== 404) {
      throw new Error(`reset(${t}) failed: ${res.status}`);
    }
  }
}
