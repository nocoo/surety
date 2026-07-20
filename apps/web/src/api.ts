export async function fetchAPI<T>(url: string): Promise<T> {
	const res = await fetch(url, { credentials: "include" });
	if (!res.ok) {
		const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
		throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
	}
	return res.json() as Promise<T>;
}
