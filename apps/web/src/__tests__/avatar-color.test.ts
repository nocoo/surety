import { describe, it, expect } from "vitest";
import { getAvatarColor, hashString } from "../lib/utils";

describe("avatar palette", () => {
  it("returns a known-readable token-backed bg class", () => {
    // The full palette — these tokens have all been verified to clear
    // ~4.5:1 contrast against white text in both light and dark mode.
    // chart-1..N tokens are intentionally NOT in this list (they are
    // tuned for fills on neutral backgrounds, not white-on-color).
    const allowed = new Set([
      "bg-badge-red",
      "bg-purple",
      "bg-purple/85",
      "bg-purple/70",
      "bg-info",
      "bg-info/85",
      "bg-primary",
      "bg-info/70",
      "bg-teal",
      "bg-teal/85",
      "bg-success",
      "bg-success/85",
      "bg-muted-foreground",
      "bg-primary/85",
      "bg-destructive",
      "bg-destructive/85",
    ]);
    const samples = ["张伟", "Alice", "李雷", "韩梅梅", "Bob", "Carol", "David"];
    for (const name of samples) {
      expect(allowed.has(getAvatarColor(name))).toBe(true);
    }
  });

  it("does not return any bg-chart-N class (chart palette is fill-only)", () => {
    const samples = Array.from({ length: 200 }, (_, i) => `name-${i}`);
    for (const name of samples) {
      expect(getAvatarColor(name)).not.toMatch(/^bg-chart-/);
    }
  });

  it("same name maps to same color (stable)", () => {
    expect(getAvatarColor("张伟")).toBe(getAvatarColor("张伟"));
    expect(getAvatarColor("Alice")).toBe(getAvatarColor("Alice"));
  });

  it("hash is stable across calls", () => {
    expect(hashString("张伟")).toBe(hashString("张伟"));
    expect(hashString("Alice")).toBe(hashString("Alice"));
  });
});
