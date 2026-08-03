import { formatLocalDate } from "@surety/db/lib/date-utils";
import { useEffect, useState } from "react";

/** Ms until the next local midnight from `now` (clamped ≥ 0). */
export function msUntilLocalMidnight(now: Date = new Date()): number {
	const nextMidnight = new Date(now);
	nextMidnight.setHours(24, 0, 0, 0);
	return Math.max(nextMidnight.getTime() - now.getTime(), 0);
}

/**
 * YYYY-MM-DD for the user's local calendar day.
 *
 * Updates at local midnight and when the tab becomes visible again
 * (laptop sleep / overnight tab). Temporal filters that depend on
 * "today" should put this key in their memo deps so counts and
 * partitions do not freeze on yesterday's classification (Codex P2).
 */
export function useLocalDateKey(): string {
	const [dateKey, setDateKey] = useState(() => formatLocalDate(new Date()));

	useEffect(() => {
		const sync = () => {
			const next = formatLocalDate(new Date());
			setDateKey((prev) => (prev === next ? prev : next));
		};

		let timeoutId: ReturnType<typeof setTimeout>;

		const armMidnight = () => {
			timeoutId = setTimeout(() => {
				sync();
				armMidnight();
			}, msUntilLocalMidnight());
		};

		armMidnight();

		const onVisibility = () => {
			if (document.visibilityState === "visible") sync();
		};
		document.addEventListener("visibilitychange", onVisibility);
		window.addEventListener("focus", sync);

		return () => {
			clearTimeout(timeoutId);
			document.removeEventListener("visibilitychange", onVisibility);
			window.removeEventListener("focus", sync);
		};
	}, []);

	return dateKey;
}
