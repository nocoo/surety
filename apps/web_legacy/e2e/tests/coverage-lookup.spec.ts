import { test, expect } from "../fixtures/base";
import { CoverageLookupPage } from "../pages/coverage-lookup.page";

test.describe("Coverage Lookup", () => {
  let coverage: CoverageLookupPage;

  test.beforeEach(async ({ page }) => {
    coverage = new CoverageLookupPage(page);
    await coverage.goto();
  });

  test("shows page heading", async () => {
    await expect(coverage.heading).toBeVisible();
  });

  test("shows member and asset tabs", async () => {
    await expect(coverage.memberTab).toBeVisible();
    await expect(coverage.assetTab).toBeVisible();
  });

  test("shows seed members in member tab", async () => {
    // Member tab should be active by default
    const seedMembers = ["张伟", "李娜", "张小明"];
    for (const name of seedMembers) {
      await expect(coverage.memberCard(name).first()).toBeVisible();
    }
  });

  test("clicking a member shows their coverage details", async ({ page }) => {
    // Click on 张伟 who has multiple policies
    await coverage.memberCard("张伟").first().click();
    await page.waitForLoadState("networkidle");

    // 张伟 has active Life and Annuity policies (寿险, 年金险)
    await expect(page.getByText("寿险").first()).toBeVisible();
  });

  test("switching to asset tab shows assets", async () => {
    await coverage.assetTab.click();

    // Seed assets: 朝阳区住宅, 特斯拉 Model Y, 大众帕萨特
    await expect(coverage.assetCard("朝阳区住宅").first()).toBeVisible();
    await expect(coverage.assetCard("特斯拉 Model Y").first()).toBeVisible();
  });

  test("clicking an asset shows its coverage", async ({ page }) => {
    await coverage.assetTab.click();
    await coverage.assetCard("朝阳区住宅").first().click();
    await page.waitForLoadState("networkidle");

    // Property insurance has expired by 2026.
    // The inactive toggle should appear because there are expired policies.
    await expect(coverage.showInactiveToggle).toBeVisible();
    await coverage.showInactiveToggle.click();
    await expect(page.getByText("财产险").first()).toBeVisible();
  });

  test("show inactive toggle exists", async () => {
    await expect(coverage.showInactiveToggle).toBeVisible();
  });
});
