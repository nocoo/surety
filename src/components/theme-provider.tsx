"use client";

/**
 * ThemeProvider — passthrough wrapper after migration to fixed Vermilion primary.
 * Dark/light mode is handled by ThemeToggle (class-based).
 * Kept as a layout wrapper for structural compatibility.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
