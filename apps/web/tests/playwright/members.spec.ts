import { test, expect } from "./fixtures";

test("members page lists the seeded family member", async ({ page }) => {
  await page.goto("/members");
  await expect(
    page.getByRole("heading", { level: 1, name: "家庭成员" }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("测试家庭成员")).toBeVisible();
});

test("clicking 添加成员 opens the member sheet", async ({ page }) => {
  await page.goto("/members");
  await page.getByRole("button", { name: "添加成员" }).click();
  await expect(page.getByRole("heading", { name: "添加成员" })).toBeVisible();
  await expect(page.getByLabel("姓名")).toBeVisible();
});
