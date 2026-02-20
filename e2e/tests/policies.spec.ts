import { test, expect } from "../fixtures/base";
import { PoliciesPage } from "../pages/policies.page";

test.describe("Policies", () => {
  let policies: PoliciesPage;

  test.beforeEach(async ({ page }) => {
    policies = new PoliciesPage(page);
    await policies.goto();
  });

  test("shows page heading and policy count", async () => {
    await expect(policies.heading).toBeVisible();
    await expect(policies.policyCount).toBeVisible();
    await expect(policies.policyCount).toContainText("共 8 份保单");
  });

  test("shows seed policies in table", async () => {
    const seedProducts = [
      "国寿福终身寿险",
      "平安福重疾险",
      "尊享e生百万医疗险",
      "安行宝综合意外险",
      "泰康鑫享人生年金险",
      "家庭财产综合险",
      "机动车综合商业险",
      "微医保长期医疗险",
    ];
    for (const name of seedProducts) {
      await expect(policies.row(name)).toBeVisible();
    }
  });

  test("view mode toggles work", async ({ page }) => {
    // Default is list view
    await expect(policies.table).toBeVisible();

    // Switch to by-category view
    await policies.byCategoryToggle.click();
    // Should show category group headings (use getByRole to avoid strict mode violations)
    await expect(
      page.getByRole("heading", { name: "寿险" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "重疾险" })
    ).toBeVisible();

    // Switch to by-insured view
    await policies.byInsuredToggle.click();
    // Should show member name group headings
    await expect(
      page.getByRole("heading", { name: "张伟" })
    ).toBeVisible();

    // Switch back to list view
    await policies.listViewToggle.click();
    await expect(policies.table).toBeVisible();
  });

  test("add a new policy", async () => {
    await policies.addButton.click();
    await expect(policies.sheet).toBeVisible();
    await expect(policies.sheetTitle).toContainText("添加保单");

    await policies.fillPolicyForm({
      productName: "E2E测试保单",
      insurerName: "测试保险公司",
      policyNumber: "E2E-001",
      category: "意外险",
      sumAssured: "500000",
      premium: "1000",
      effectiveDate: "2026-01-01",
      applicant: "张伟",
      insured: "李娜",
    });

    await policies.submitButton.click();

    await expect(policies.sheet).not.toBeVisible();
    await expect(policies.row("E2E测试保单")).toBeVisible();
  });

  test("edit an existing policy", async () => {
    await policies.editButton("安行宝综合意外险").click();
    await expect(policies.sheet).toBeVisible();
    await expect(policies.sheetTitle).toContainText("编辑保单");

    // Update premium
    await policies.premiumInput.fill("500");
    await policies.submitButton.click();

    await expect(policies.sheet).not.toBeVisible();
    await expect(policies.row("安行宝综合意外险")).toBeVisible();
  });

  test("delete a policy", async () => {
    // First create a policy to delete (applicant is required by API)
    await policies.addButton.click();
    await policies.fillPolicyForm({
      productName: "待删除保单",
      insurerName: "临时保险",
      policyNumber: "DEL-001",
      category: "意外险",
      sumAssured: "100000",
      premium: "200",
      effectiveDate: "2026-01-01",
      applicant: "张伟",
    });
    await policies.submitButton.click();
    await expect(policies.sheet).not.toBeVisible();
    await expect(policies.row("待删除保单")).toBeVisible();

    // Delete it
    await policies.deleteButton("待删除保单").click();
    await expect(policies.deleteDialog).toBeVisible();
    await expect(policies.deleteDialog).toContainText("待删除保单");

    await policies.deleteConfirmButton.click();
    await expect(policies.deleteDialog).not.toBeVisible();
    await expect(policies.row("待删除保单")).not.toBeVisible();
  });

  test("cancel adding a policy closes sheet without changes", async () => {
    // Capture current count before cancelling
    const countText = await policies.policyCount.textContent();

    await policies.addButton.click();
    await expect(policies.sheet).toBeVisible();

    await policies.productNameInput.fill("不应该添加的保单");
    await policies.cancelButton.click();

    await expect(policies.sheet).not.toBeVisible();
    // Count should remain unchanged
    await expect(policies.policyCount).toContainText(countText!);
  });
});
