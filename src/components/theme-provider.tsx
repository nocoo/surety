"use client";

import { createContext, useContext, useLayoutEffect, useSyncExternalStore } from "react";

export type ThemeColor = "orange" | "blue" | "green" | "purple" | "rose";

const VALID_COLORS: ThemeColor[] = ["orange", "blue", "green", "purple", "rose"];

function getStoredTheme(): ThemeColor {
  if (typeof window === "undefined") return "orange";
  const stored = localStorage.getItem("theme-color");
  if (stored && VALID_COLORS.includes(stored as ThemeColor)) {
    return stored as ThemeColor;
  }
  return "orange";
}

interface ThemeContextValue {
  themeColor: ThemeColor;
  setThemeColor: (color: ThemeColor) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Use useSyncExternalStore pattern for SSR-safe localStorage access
  const themeColor = useSyncExternalStore(
    (callback) => {
      window.addEventListener("storage", callback);
      return () => window.removeEventListener("storage", callback);
    },
    getStoredTheme,
    () => "orange" as ThemeColor // Server snapshot
  );

  // Use useLayoutEffect to update DOM synchronously (no setState, just DOM manipulation)
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", themeColor);
  }, [themeColor]);

  const setThemeColor = (color: ThemeColor) => {
    localStorage.setItem("theme-color", color);
    // Dispatch storage event to trigger useSyncExternalStore
    window.dispatchEvent(new StorageEvent("storage", { key: "theme-color", newValue: color }));
  };

  return (
    <ThemeContext.Provider value={{ themeColor, setThemeColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
