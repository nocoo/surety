import { test, expect } from "../fixtures/base";

/**
 * Navigation tests verify the sidebar links work correctly
 * and each page loads without errors.
 */
test.describe("Navigation", () => {
  const routes = [
    { path: "/", heading: "仪表盘" },
    { path: "/coverage-lookup", heading: "保障速查" },
    { path: "/renewal-calendar", heading: "续保日历" },
    { path: "/policies", heading: "全部保单" },
    { path: "/members", heading: "家庭成员" },
    { path: "/insurers", heading: "保险公司" },
    { path: "/assets", heading: "资产管理" },
    { path: "/settings", heading: "设置" },
  ];

  for (const route of routes) {
    test(`navigates to ${route.heading} (${route.path})`, async ({
      page,
      navigateTo,
    }) => {
      await navigateTo(route.path);
      await expect(
        page.getByRole("heading", { name: route.heading, exact: true })
      ).toBeVisible();
    });
  }

  test("sidebar navigation links work", async ({ page, navigateTo }) => {
    await navigateTo("/");

    // Click on "保单管理" in sidebar
    await page.getByRole("link", { name: "保单管理" }).click();
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", { name: "全部保单", exact: true })
    ).toBeVisible();

    // Click on "家庭成员" in sidebar
    await page.getByRole("link", { name: "家庭成员" }).click();
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", { name: "家庭成员", exact: true })
    ).toBeVisible();

    // Click on "系统设置" in sidebar
    await page.getByRole("link", { name: "系统设置" }).click();
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", { name: "设置", exact: true })
    ).toBeVisible();

    // Click on "仪表盘" to go back to dashboard
    await page.getByRole("link", { name: "仪表盘" }).click();
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", { name: "仪表盘", exact: true })
    ).toBeVisible();
  });
});
