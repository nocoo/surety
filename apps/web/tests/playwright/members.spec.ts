import { test, expect } from "./fixtures";

test.describe.serial("members page CRUD", () => {
  test("renders the members page with header and table", async ({ page }) => {
    await page.goto("/members");
    await expect(
      page.getByRole("heading", { level: 1, name: "家庭成员" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("table")).toBeVisible({ timeout: 10_000 });
  });

  test("shows the seeded member", async ({ page }) => {
    await page.goto("/members");
    await expect(page.getByText("测试家庭成员")).toBeVisible({ timeout: 10_000 });
  });

  test("creates a new member", async ({ page }) => {
    await page.goto("/members");
    await page.getByRole("button", { name: "添加成员" }).click();
    await expect(
      page.getByRole("heading", { name: "添加成员" }),
    ).toBeVisible({ timeout: 10_000 });

    await page.getByLabel("姓名").fill("L3新增成员");
    await page.getByLabel("出生日期").fill("1990-06-15");

    // Select relation
    const relationTrigger = page.locator("button").filter({ hasText: "选择关系" });
    await relationTrigger.click();
    await page.getByRole("option", { name: "配偶" }).click();

    // Select gender
    const genderTrigger = page.locator("button").filter({ hasText: "选择性别" });
    await genderTrigger.click();
    await page.getByRole("option", { name: "女" }).click();

    await page.getByRole("button", { name: "添加成员", exact: true }).click();

    await expect(
      page.getByRole("heading", { name: "添加成员" }),
    ).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText("L3新增成员")).toBeVisible({ timeout: 10_000 });
  });

  test("edits an existing member", async ({ page }) => {
    await page.goto("/members");
    const row = page.getByRole("row").filter({ hasText: "L3新增成员" });
    await row.getByRole("button", { name: "编辑" }).click();

    await expect(
      page.getByRole("heading", { name: "编辑成员" }),
    ).toBeVisible({ timeout: 10_000 });

    await page.getByLabel("手机号").fill("13800138000");
    await page.getByRole("button", { name: "保存修改" }).click();

    await expect(
      page.getByRole("heading", { name: "编辑成员" }),
    ).toBeHidden({ timeout: 10_000 });

    const editedRow = page.getByRole("row").filter({ hasText: "L3新增成员" });
    await expect(editedRow).toContainText("13800138000", { timeout: 10_000 });
  });

  test("deletes a member", async ({ page }) => {
    await page.goto("/members");

    const row = page.getByRole("row").filter({ hasText: "L3新增成员" });
    await row.getByRole("button", { name: "删除成员" }).click();

    await expect(
      page.getByRole("alertdialog").getByText("确认删除"),
    ).toBeVisible({ timeout: 10_000 });
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "删除" })
      .click();

    await expect(page.getByText("L3新增成员")).toHaveCount(0, {
      timeout: 10_000,
    });
  });

});
