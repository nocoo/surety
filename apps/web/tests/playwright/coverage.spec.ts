import { test, expect } from "./fixtures";

test("coverage-lookup page renders selectors", async ({ page }) => {
  await page.goto("/coverage-lookup");
  await expect(
    page.getByRole("heading", { level: 1, name: "保障速查" }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("测试家庭成员").first()).toBeVisible();
});
