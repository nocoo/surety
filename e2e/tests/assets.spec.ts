import { test, expect } from "../fixtures/base";
import { AssetsPage } from "../pages/assets.page";

test.describe("Assets", () => {
  let assets: AssetsPage;

  test.beforeEach(async ({ page }) => {
    assets = new AssetsPage(page);
    await assets.goto();
  });

  test("shows page heading and asset count", async () => {
    await expect(assets.heading).toBeVisible();
    await expect(assets.assetCount).toBeVisible();
    await expect(assets.assetCount).toContainText("共 3 项资产");
  });

  test("shows seed assets in table", async () => {
    await expect(assets.row("朝阳区住宅")).toBeVisible();
    await expect(assets.row("特斯拉 Model Y")).toBeVisible();
    await expect(assets.row("大众帕萨特")).toBeVisible();
  });

  test("shows correct asset types", async () => {
    await expect(assets.row("朝阳区住宅")).toContainText("不动产");
    await expect(assets.row("特斯拉 Model Y")).toContainText("车辆");
  });

  test("assets with policies cannot be deleted", async () => {
    // 朝阳区住宅 and 特斯拉 Model Y have linked policies
    const deleteBtn = assets.deleteButton("朝阳区住宅");
    await expect(deleteBtn).toBeDisabled();
  });

  test("add a new asset", async ({ page }) => {
    await assets.addButton.click();
    await expect(assets.sheet).toBeVisible();

    await assets.nameInput.fill("E2E测试资产");
    await assets.identifierInput.fill("TEST-001");

    // Select asset type
    const trigger = assets.sheet
      .locator('[data-slot="select-trigger"]')
      .first();
    await trigger.click();
    await page.getByRole("option", { name: "车辆" }).click();

    await assets.submitButton.click();

    await expect(assets.sheet).not.toBeVisible();
    await expect(assets.row("E2E测试资产")).toBeVisible();
    await expect(assets.assetCount).toContainText("共 4 项资产");
  });

  test("edit an existing asset", async () => {
    // 大众帕萨特 should be editable (fewer policies)
    await assets.editButton("大众帕萨特").click();
    await expect(assets.sheet).toBeVisible();

    await assets.nameInput.fill("大众帕萨特 2021款");
    await assets.submitButton.click();

    await expect(assets.sheet).not.toBeVisible();
    await expect(assets.row("大众帕萨特 2021款")).toBeVisible();
  });

  test("delete an asset without policies", async ({ page }) => {
    // First add an asset we can delete
    await assets.addButton.click();
    await assets.nameInput.fill("待删除资产");
    await assets.identifierInput.fill("DEL-ASSET");

    const trigger = assets.sheet
      .locator('[data-slot="select-trigger"]')
      .first();
    await trigger.click();
    await page.getByRole("option", { name: "车辆" }).click();

    await assets.submitButton.click();
    await expect(assets.sheet).not.toBeVisible();
    await expect(assets.row("待删除资产")).toBeVisible();

    // Delete it
    await assets.deleteButton("待删除资产").click();
    await expect(assets.deleteDialog).toBeVisible();
    await expect(assets.deleteDialog).toContainText("待删除资产");

    await assets.deleteConfirmButton.click();
    await expect(assets.deleteDialog).not.toBeVisible();
    await expect(assets.row("待删除资产")).not.toBeVisible();
  });
});
