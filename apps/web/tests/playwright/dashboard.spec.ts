import { test, expect } from "./fixtures";

test.describe("dashboard page", () => {
  test("renders heading and overview text", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "仪表盘" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("家庭保障概览")).toBeVisible();
  });

  test("stat cards render with seeded data", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("家庭保障概览")).toBeVisible({ timeout: 10_000 });

    // The seeded data has 1 policy and 1 member
    // Stat cards should show non-zero values
    const statCards = page.locator(".rounded-card.bg-secondary.p-6");
    await expect(statCards.first()).toBeVisible({ timeout: 10_000 });

    // Should have 4 stat cards
    await expect(statCards).toHaveCount(4);
  });

  test("chart sections render after data load", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("家庭保障概览")).toBeVisible({ timeout: 10_000 });

    // Check key chart titles are rendered
    await expect(page.getByText("保费构成")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("保障额度构成")).toBeVisible();
    await expect(page.getByText("险种构成")).toBeVisible();
    await expect(page.getByText("保险公司分布")).toBeVisible();
  });

  test("member-related charts render", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("家庭保障概览")).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText("成员保费分布")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("成员保障额度")).toBeVisible();
    await expect(page.getByText("成员险种分布")).toBeVisible();
  });

  test("timeline charts render", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("家庭保障概览")).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText("续费时间分布")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("到期时间分布")).toBeVisible();
  });
});
