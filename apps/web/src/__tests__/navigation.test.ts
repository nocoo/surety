import { describe, it, expect } from "vitest";
import {
  isItemActive,
  shouldGroupBeOpenOnMount,
  NAV_GROUPS,
} from "@/lib/navigation";

describe("isItemActive", () => {
  it("matches '/' exactly only on '/'", () => {
    expect(isItemActive("/", "/")).toBe(true);
    expect(isItemActive("/", "/policies")).toBe(false);
  });

  it("matches a non-root href as a prefix", () => {
    expect(isItemActive("/policies", "/policies")).toBe(true);
    expect(isItemActive("/policies", "/policies/42")).toBe(true);
    expect(isItemActive("/members", "/policies")).toBe(false);
  });
});

describe("shouldGroupBeOpenOnMount", () => {
  it("opens the group containing the current route", () => {
    const dev = NAV_GROUPS.find((g) => g.label === "开发者");
    if (!dev) throw new Error("expected '开发者' group to exist");
    // 开发者 has defaultOpen: false but still opens when on /cli.
    expect(shouldGroupBeOpenOnMount(dev, "/cli")).toBe(true);
    // It stays collapsed when the user is somewhere else.
    expect(shouldGroupBeOpenOnMount(dev, "/")).toBe(false);
  });

  it("respects defaultOpen=true even without a route match", () => {
    const overview = NAV_GROUPS.find((g) => g.label === "总览");
    if (!overview) throw new Error("expected '总览' group to exist");
    expect(shouldGroupBeOpenOnMount(overview, "/policies")).toBe(true);
  });

  it("defaults to open when defaultOpen is undefined", () => {
    expect(
      shouldGroupBeOpenOnMount({ items: [{ href: "/x" }] }, "/y"),
    ).toBe(true);
  });

  it("honours an explicit defaultOpen=false when no item matches", () => {
    expect(
      shouldGroupBeOpenOnMount(
        { items: [{ href: "/cli" }], defaultOpen: false },
        "/policies",
      ),
    ).toBe(false);
  });

  it("opens deep-link sub-paths (e.g. /policies/42 opens 数据管理)", () => {
    const dataMgmt = NAV_GROUPS.find((g) => g.label === "数据管理");
    if (!dataMgmt) throw new Error("expected '数据管理' group to exist");
    expect(shouldGroupBeOpenOnMount(dataMgmt, "/policies/42")).toBe(true);
  });
});
