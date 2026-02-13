"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const THEME_CHANGE_EVENT = "theme-change";

function subscribeToTheme(callback: () => void) {
  // Re-render on OS-level color scheme change
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", callback);
  // Re-render on manual toggle
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  return () => {
    mediaQuery.removeEventListener("change", callback);
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
  };
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot() {
  return false;
}

export function ThemeToggle() {
  const isDark = useSyncExternalStore(
    subscribeToTheme,
    getSnapshot,
    getServerSnapshot
  );

  const toggle = () => {
    const root = document.documentElement;
    const newIsDark = !root.classList.contains("dark");

    if (newIsDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }

    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  };

  return (
    <Button variant="ghost" size="icon" onClick={toggle}>
      {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      <span className="sr-only">切换主题</span>
    </Button>
  );
}
