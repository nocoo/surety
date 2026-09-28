import { afterEach, expect, test, vi } from "vitest";
import { externalFetch } from "../src/lib/external-fetch";
import type { Bindings } from "../src/lib/types";

afterEach(() => vi.unstubAllGlobals());
test("isolated provider boundary keeps real request shape and rejects foreign targets", async () => {
	const fetcher = vi.fn(async () => Response.json({ success: true }));
	vi.stubGlobal("fetch", fetcher);
	const env = { ENVIRONMENT: "local", LOCAL_EXTERNAL_ORIGIN: "http://127.0.0.1:12345" } as Bindings;
	await externalFetch(env)("https://backy.example.invalid/webhook", {
		method: "POST",
		body: "backup",
	});
	expect(fetcher).toHaveBeenCalledWith("http://127.0.0.1:12345/webhook", {
		method: "POST",
		body: "backup",
	});
	await expect(externalFetch(env)("https://real.example/webhook")).rejects.toThrow("unavailable");
	await expect(
		externalFetch({ ENVIRONMENT: "local" } as Bindings)("https://lizheng.blog/api/authors/profile"),
	).rejects.toThrow("unavailable");
	for (const origin of ["https://127.0.0.1", "http://external.example"])
		await expect(
			externalFetch({ ...env, LOCAL_EXTERNAL_ORIGIN: origin })(
				"https://lizheng.blog/api/authors/profile",
			),
		).rejects.toThrow("Invalid");
	await externalFetch({ ENVIRONMENT: "production" } as Bindings)(
		"https://lizheng.blog/api/authors/profile",
	);
	expect(fetcher).toHaveBeenLastCalledWith("https://lizheng.blog/api/authors/profile", undefined);
});
