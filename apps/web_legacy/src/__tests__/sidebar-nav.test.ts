import { describe, expect, test } from "bun:test";
import { NAV_GROUPS, ALL_NAV_ITEMS } from "@/components/layout/sidebar";
import type { NavGroup, NavItem } from "@/components/layout/sidebar";
import { LayoutDashboard } from "lucide-react";

describe("Sidebar NAV_GROUPS", () => {
  test("has exactly 4 groups: 总览, 数据管理, 就诊管理, 系统", () => {
    expect(NAV_GROUPS).toHaveLength(4);
    expect(NAV_GROUPS.map((g) => g.label)).toEqual([
      "总览",
      "数据管理",
      "就诊管理",
      "系统",
    ]);
  });

  test("all groups default to open", () => {
    for (const group of NAV_GROUPS) {
      expect(group.defaultOpen).toBe(true);
    }
  });

  test("总览 group contains dashboard, coverage-lookup, renewal-calendar", () => {
    const overview = NAV_GROUPS.find((g) => g.label === "总览");
    expect(overview).toBeDefined();
    expect((overview as NavGroup).items).toHaveLength(3);
    expect((overview as NavGroup).items.map((i) => i.href)).toEqual([
      "/",
      "/coverage-lookup",
      "/renewal-calendar",
    ]);
  });

  test("数据管理 group contains policies, members, insurers, assets", () => {
    const data = NAV_GROUPS.find((g) => g.label === "数据管理");
    expect(data).toBeDefined();
    expect((data as NavGroup).items).toHaveLength(4);
    expect((data as NavGroup).items.map((i) => i.href)).toEqual([
      "/policies",
      "/members",
      "/insurers",
      "/assets",
    ]);
  });

  test("就诊管理 group contains medical-visits, hospitals, doctors", () => {
    const medical = NAV_GROUPS.find((g) => g.label === "就诊管理");
    expect(medical).toBeDefined();
    expect((medical as NavGroup).items).toHaveLength(3);
    expect((medical as NavGroup).items.map((i) => i.href)).toEqual([
      "/medical-visits",
      "/hospitals",
      "/doctors",
    ]);
  });

  test("系统 group contains settings", () => {
    const system = NAV_GROUPS.find((g) => g.label === "系统");
    expect(system).toBeDefined();
    expect((system as NavGroup).items).toHaveLength(1);
    const firstItem = (system as NavGroup).items[0] as NavItem;
    expect(firstItem.href).toBe("/settings");
  });

  test("every item has required fields (href, label, icon)", () => {
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        expect(typeof item.href).toBe("string");
        expect(item.href.startsWith("/")).toBe(true);
        expect(typeof item.label).toBe("string");
        expect(item.label.length).toBeGreaterThan(0);
        expect(item.icon).toBeTruthy();
      }
    }
  });

  test("no duplicate hrefs across all groups", () => {
    const hrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    const unique = new Set(hrefs);
    expect(unique.size).toBe(hrefs.length);
  });
});

describe("ALL_NAV_ITEMS", () => {
  test("is the flat list of all items from all groups", () => {
    const expected = NAV_GROUPS.flatMap((g) => g.items);
    expect(ALL_NAV_ITEMS).toEqual(expected);
  });

  test("has 11 total navigation items", () => {
    expect(ALL_NAV_ITEMS).toHaveLength(11);
  });

  test("preserves group order (总览 items first, then 数据管理, then 就诊管理, then 系统)", () => {
    const labels = ALL_NAV_ITEMS.map((i) => i.label);
    expect(labels).toEqual([
      "仪表盘",
      "保障速查",
      "续保日历",
      "保单管理",
      "家庭成员",
      "保险公司",
      "资产管理",
      "就诊记录",
      "医院管理",
      "医生管理",
      "系统设置",
    ]);
  });
});

describe("NavGroup type contract", () => {
  test("group satisfies NavGroup interface", () => {
    const group: NavGroup = {
      label: "Test",
      items: [{ href: "/test", label: "Test", icon: LayoutDashboard }],
      defaultOpen: false,
    };
    expect(group.label).toBe("Test");
    expect(group.defaultOpen).toBe(false);
    expect(group.items).toHaveLength(1);
  });

  test("NavItem requires href, label, icon", () => {
    const item: NavItem = {
      href: "/foo",
      label: "Foo",
      icon: LayoutDashboard,
    };
    expect(item.href).toBe("/foo");
    expect(item.label).toBe("Foo");
  });
});
