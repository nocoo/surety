import { test, expect } from "./fixtures";

test.describe("coverage-lookup page", () => {
  test("renders heading and member selector", async ({ page }) => {
    await page.goto("/coverage-lookup");
    await expect(
      page.getByRole("heading", { level: 1, name: "保障速查" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("快速查看家庭成员和资产的保障信息")).toBeVisible();
  });

  test("member tab is active by default and shows seeded member", async ({ page }) => {
    await page.goto("/coverage-lookup");
    await expect(page.getByText("测试家庭成员").first()).toBeVisible({
      timeout: 10_000,
    });

    // The member card should show policy summary
    await expect(page.getByText("1 份保单")).toBeVisible();
  });

  test("shows category sections for seeded member with policy", async ({ page }) => {
    await page.goto("/coverage-lookup");
    await expect(page.getByText("测试家庭成员").first()).toBeVisible({
      timeout: 10_000,
    });

    // Seeded policy is Health category — should show coverage section
    // Wait for data to load and render
    await expect(page.locator("[class*='rounded-card']").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("switches to asset tab", async ({ page }) => {
    await page.goto("/coverage-lookup");
    await expect(
      page.getByRole("heading", { level: 1, name: "保障速查" }),
    ).toBeVisible({ timeout: 10_000 });

    const assetBtn = page.getByRole("button", { name: /资产/ });
    await assetBtn.click();

    // After switching to asset tab, should show asset selector
    // Seeded asset "L3种子公寓" should appear
    await expect(page.getByText("L3种子公寓").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("switches back to member tab", async ({ page }) => {
    await page.goto("/coverage-lookup");
    await expect(
      page.getByRole("heading", { level: 1, name: "保障速查" }),
    ).toBeVisible({ timeout: 10_000 });

    // Switch to asset
    await page.getByRole("button", { name: /资产/ }).click();
    await expect(page.getByText("L3种子公寓").first()).toBeVisible({
      timeout: 10_000,
    });

    // Switch back to member
    await page.getByRole("button", { name: /家庭成员/ }).click();
    await expect(page.getByText("测试家庭成员").first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
