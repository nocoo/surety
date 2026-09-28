import type { FetchLike } from "./author-profile";
import type { Bindings } from "./types";

export function externalFetch(env: Bindings): FetchLike {
	return async (input, init) => {
		if (env?.ENVIRONMENT !== "local") return fetch(input, init);
		const url = new URL(String(input));
		if (
			!env.LOCAL_EXTERNAL_ORIGIN ||
			!["lizheng.blog", "backy.example.invalid"].includes(url.hostname)
		)
			throw new Error("External destination unavailable in isolated local runtime");
		const target = new URL(env.LOCAL_EXTERNAL_ORIGIN);
		if (target.hostname !== "127.0.0.1" || target.protocol !== "http:")
			throw new Error("Invalid local provider boundary");
		return fetch(`${target.origin}${url.pathname}${url.search}`, init);
	};
}
