import { test, expect } from "../fixtures/base";
import { InsurersPage } from "../pages/insurers.page";

test.describe("Insurers", () => {
  let insurers: InsurersPage;

  test.beforeEach(async ({ page }) => {
    insurers = new InsurersPage(page);
    await insurers.goto();
  });

  test("shows page heading and insurer count", async () => {
    await expect(insurers.heading).toBeVisible();
    await expect(insurers.insurerCount).toBeVisible();
  });

  test("shows seed insurers in table", async () => {
    // Seed data creates insurers for each unique insurerName in policies
    const seedInsurers = [
      "中国人寿",
      "平安保险",
      "众安保险",
      "太平洋保险",
      "泰康人寿",
      "人保财险",
      "太平洋财险",
      "泰康在线",
    ];
    for (const name of seedInsurers) {
      await expect(insurers.row(name)).toBeVisible();
    }
  });

  test("insurers with policies cannot be deleted", async () => {
    // 中国人寿 has policies linked (policyCount > 0)
    const deleteBtn = insurers.deleteButton("中国人寿");
    await expect(deleteBtn).toBeDisabled();
  });

  test("add a new insurer", async () => {
    await insurers.addButton.click();
    await expect(insurers.sheet).toBeVisible();

    await insurers.nameInput.fill("E2E测试保险公司");
    await insurers.phoneInput.fill("95500");
    await insurers.websiteInput.fill("https://test.example.com");

    await insurers.submitButton.click();

    await expect(insurers.sheet).not.toBeVisible();
    await expect(insurers.row("E2E测试保险公司")).toBeVisible();
  });

  test("edit an existing insurer", async () => {
    await insurers.addButton.click();
    await insurers.nameInput.fill("待编辑保险公司");
    await insurers.submitButton.click();
    await expect(insurers.sheet).not.toBeVisible();

    await insurers.editButton("待编辑保险公司").click();
    await expect(insurers.sheet).toBeVisible();

    await insurers.phoneInput.fill("12345");
    await insurers.submitButton.click();

    await expect(insurers.sheet).not.toBeVisible();
    await expect(insurers.row("待编辑保险公司")).toBeVisible();
  });

  test("delete an insurer without policies", async () => {
    // Add a new insurer first
    await insurers.addButton.click();
    await insurers.nameInput.fill("待删除保险公司");
    await insurers.submitButton.click();
    await expect(insurers.sheet).not.toBeVisible();
    await expect(insurers.row("待删除保险公司")).toBeVisible();

    // Delete it
    await insurers.deleteButton("待删除保险公司").click();
    await expect(insurers.deleteDialog).toBeVisible();
    await expect(insurers.deleteDialog).toContainText("待删除保险公司");

    await insurers.deleteConfirmButton.click();
    await expect(insurers.deleteDialog).not.toBeVisible();
    await expect(insurers.row("待删除保险公司")).not.toBeVisible();
  });
});
