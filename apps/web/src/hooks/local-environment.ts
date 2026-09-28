export type LocalMode = "demo" | "e2e" | "prod";
export interface LocalEnvironment {
	id: string;
	mode: LocalMode;
	locked: boolean;
	visible: boolean;
}
const preferenceKey = "surety:environment-mode";
const sessionKey = "surety:environment-instance";
export let localEnvironment: LocalEnvironment | null = null;
const originalFetch = globalThis.fetch.bind(globalThis);
function stored(storage: "localStorage" | "sessionStorage", key: string) {
	try {
		return window[storage].getItem(key);
	} catch {
		return null;
	}
}
export async function initializeEnvironment() {
	const capability = await originalFetch("/__local/capability");
	if (!capability.ok || !capability.headers.get("content-type")?.includes("application/json"))
		return;
	const config = await capability.json();
	if (config.local !== true) return;
	const transfer = new URLSearchParams(window.location.search).get("__surety_instance");
	const body = config.locked
		? {}
		: {
				id: transfer ?? stored("sessionStorage", sessionKey),
				preference: stored("localStorage", preferenceKey),
			};
	const res = await originalFetch("/__local/start", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!res.ok) throw new Error(await res.text());
	localEnvironment = await res.json();
	if (transfer && !config.locked) window.history.replaceState(null, "", window.location.pathname);
	if (localEnvironment && !localEnvironment.locked) {
		try {
			sessionStorage.setItem(sessionKey, localEnvironment.id);
		} catch {}
	}
}
export function apiUrl(url: string) {
	return localEnvironment && url.startsWith("/api/")
		? `/__instance/${localEnvironment.id}${url}`
		: url;
}
export function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
	return globalThis.fetch(typeof input === "string" ? apiUrl(input) : input, init);
}
export async function switchEnvironment(mode: LocalMode) {
	if (!localEnvironment || localEnvironment.locked) return;
	const guard = new Event("surety:discard-drafts", { cancelable: true });
	window.dispatchEvent(guard);
	const openDialog = document.querySelector('[role="dialog"]');
	if (
		(guard.defaultPrevented || openDialog) &&
		!window.confirm("有未保存的修改，丢弃草稿并切换环境？")
	)
		return;
	const res = await originalFetch("/__local/switch", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ id: localEnvironment.id, mode }),
	});
	if (!res.ok) throw new Error(await res.text());
	const accepted = (await res.json()) as LocalEnvironment;
	try {
		localStorage.setItem(preferenceKey, accepted.mode);
		sessionStorage.setItem(sessionKey, accepted.id);
	} catch {}
	window.dispatchEvent(new Event("surety:accepted-discard"));
	window.location.replace(`/?__surety_instance=${accepted.id}`);
}
