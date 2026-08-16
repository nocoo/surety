export const AUTHOR_PROFILE_ENDPOINT = "https://lizheng.blog/api/authors/profile";

export type AuthorProfile = {
	name: string | null;
	avatar: string | null;
};

const EMPTY: AuthorProfile = { name: null, avatar: null };

export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export async function hashEmail(email: string): Promise<string> {
	const bytes = new TextEncoder().encode(normalizeEmail(email));
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function readProfile(data: unknown): AuthorProfile {
	if (!data || typeof data !== "object") return EMPTY;
	const rec = data as { name?: unknown; avatar?: unknown };
	const name = typeof rec.name === "string" && rec.name.length > 0 ? rec.name : null;
	const avatar = typeof rec.avatar === "string" && rec.avatar.length > 0 ? rec.avatar : null;
	return { name, avatar };
}

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function fetchAuthorProfile(
	email: string,
	fetchFn: FetchLike = fetch,
): Promise<AuthorProfile> {
	const hash = await hashEmail(email);
	try {
		const res = await fetchFn(`${AUTHOR_PROFILE_ENDPOINT}?hash=${hash}`, {
			signal: AbortSignal.timeout(2500),
		});
		if (!res.ok) return EMPTY;
		return readProfile(await res.json());
	} catch {
		return EMPTY;
	}
}
