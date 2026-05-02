import { describe, expect, test } from "vitest";
import { getDisplayName } from "../lib/user";

describe("getDisplayName", () => {
  test("uses email local-part when name missing", () => {
    const { name, initial, email } = getDisplayName({ email: "zheng@hexly.ai", name: null });
    expect(name).toBe("zheng");
    expect(initial).toBe("Z");
    expect(email).toBe("zheng@hexly.ai");
  });

  test("prefers explicit name over email", () => {
    const { name, initial } = getDisplayName({ email: "zheng@hexly.ai", name: "Zheng Li" });
    expect(name).toBe("Zheng Li");
    expect(initial).toBe("Z");
  });

  test("falls back to '用户' / 'U' when no user info", () => {
    const { name, initial, email } = getDisplayName(null);
    expect(name).toBe("用户");
    expect(initial).toBe("U");
    expect(email).toBeNull();
  });

  test("handles empty name string", () => {
    const { name } = getDisplayName({ email: "a@b.com", name: "" });
    expect(name).toBe("a");
  });
});
