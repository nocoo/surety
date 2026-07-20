import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;

function getSnapshot(): boolean {
	return window.innerWidth < MOBILE_BREAKPOINT;
}

function getServerSnapshot(): boolean {
	// Default to false (desktop) on server to avoid layout shift
	return false;
}

function subscribe(callback: () => void): () => void {
	const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
	mql.addEventListener("change", callback);
	window.addEventListener("resize", callback);
	return () => {
		mql.removeEventListener("change", callback);
		window.removeEventListener("resize", callback);
	};
}

export function useIsMobile(): boolean {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
