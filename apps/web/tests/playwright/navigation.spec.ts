import { test, expect } from "./fixtures";

const NAV = [
  { href: "/", h1: "仪表盘" },
  { href: "/coverage-lookup", h1: "保障速查" },
  { href: "/renewal-calendar", h1: "续保日历" },
  { href: "/policies", h1: "全部保单" },
  { href: "/members", h1: "家庭成员" },
  { href: "/insurers", h1: "保险公司" },
  { href: "/assets", h1: "资产管理" },
  { href: "/medical-visits", h1: "就诊记录" },
  { href: "/hospitals", h1: "医院管理" },
  { href: "/doctors", h1: "医生管理" },
  { href: "/settings", h1: "设置" },
];

test("every primary route renders its H1", async ({ page }) => {
  for (const { href, h1 } of NAV) {
    await page.goto(href);
    await expect(
      page.getByRole("heading", { level: 1, name: h1 }),
    ).toBeVisible({ timeout: 10_000 });
  }
});
