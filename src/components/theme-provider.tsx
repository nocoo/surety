"use client";

import { createContext, useContext } from "react";

/**
 * ThemeProvider — simplified after migration to fixed Vermilion primary.
 * Dark/light mode is handled by ThemeToggle (class-based).
 * This provider is kept as a thin wrapper for layout compatibility.
 */

// Kept for backward compatibility — will be removed when settings page is updated
export type ThemeColor = "orange" | "blue" | "green" | "purple" | "rose";

interface ThemeContextValue {
  themeColor: ThemeColor;
  setThemeColor: (color: ThemeColor) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // No-op: fixed vermilion primary, no data-theme attribute needed
  const value: ThemeContextValue = {
    themeColor: "orange",
    setThemeColor: () => {}, // no-op
  };

  return (
    <ThemeContext.Provider value={value}>
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
