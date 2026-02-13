"use client";

import { useSyncExternalStore } from "react";

/**
 * Must match the event name used in ThemeToggle so the hook
 * re-renders whenever the user toggles the theme.
 */
const THEME_CHANGE_EVENT = "theme-change";

function subscribe(callback: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", callback);
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  return () => {
    mq.removeEventListener("change", callback);
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
  };
}

function getSnapshot(): "light" | "dark" {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): "light" | "dark" {
  return "light";
}

/**
 * Returns the effectively applied theme ("light" | "dark").
 * Reacts to both manual toggles and OS-level preference changes.
 */
export function useAppliedTheme(): "light" | "dark" {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
