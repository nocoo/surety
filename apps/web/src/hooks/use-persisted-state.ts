import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A useState replacement that persists the value to localStorage.
 * Uses lazy initializer to read from localStorage on first render.
 *
 * @param key - localStorage key
 * @param defaultValue - fallback when no stored value exists
 */
export function usePersistedState<T extends string>(
	key: string,
	defaultValue: T,
): [T, (value: T) => void] {
	const [value, setValue] = useState<T>(() => {
		if (typeof window === "undefined") return defaultValue;
		try {
			const stored = localStorage.getItem(key);
			return stored !== null ? (stored as T) : defaultValue;
		} catch {
			return defaultValue;
		}
	});

	// Track whether the initial render has completed to avoid
	// writing the default value back to localStorage on mount.
	const isInitialRender = useRef(true);

	// Persist to localStorage on change
	useEffect(() => {
		if (isInitialRender.current) {
			isInitialRender.current = false;
			return;
		}
		try {
			if (value === defaultValue) {
				localStorage.removeItem(key);
			} else {
				localStorage.setItem(key, value);
			}
		} catch {
			// localStorage unavailable
		}
	}, [key, value, defaultValue]);

	const setPersistedValue = useCallback((newValue: T) => {
		setValue(newValue);
	}, []);

	return [value, setPersistedValue];
}
