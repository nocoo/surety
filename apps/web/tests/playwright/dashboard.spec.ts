import { test, expect } from "./fixtures";

test.describe("dashboard page", () => {
  test("renders heading and overview text", async ({ page }) => {
    await page.goto("/");
    // Dashboard h1 is a greeting (e.g. "早上好，xxx") — bucket varies by hour
    // and the name varies by signed-in user, so assert structural presence only.
    await expect(
      page.getByRole("heading", { level: 1 }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("家庭概览")).toBeVisible();
  });

  test("stat cards render with seeded data", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("家庭概览")).toBeVisible({ timeout: 10_000 });

    // The seeded data has 1 policy and 1 member
    // Stat cards should show non-zero values
    // animate-fade-up is the StatCard-specific entrance animation; without it
    // the selector also picks up the action-items / health cards in the same
    // row family.
    const statCards = page.locator(".rounded-card.bg-secondary.p-6.animate-fade-up");
    await expect(statCards.first()).toBeVisible({ timeout: 10_000 });

    // Should have 4 stat cards
    await expect(statCards).toHaveCount(4);
  });

  test("chart sections render after data load", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("家庭概览")).toBeVisible({ timeout: 10_000 });

    // Check key chart titles are rendered
    await expect(page.getByText("保费构成")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("保障额度构成")).toBeVisible();
    await expect(page.getByText("险种构成")).toBeVisible();
    await expect(page.getByText("保险公司分布")).toBeVisible();
  });

  test("member-related charts render", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("家庭概览")).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText("成员保费分布")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("成员保障额度")).toBeVisible();
    await expect(page.getByText("成员险种分布")).toBeVisible();
  });

  test("timeline charts render", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("家庭概览")).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText("续费时间分布")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("到期时间分布")).toBeVisible();
  });
});
