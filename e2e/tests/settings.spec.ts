import { test, expect } from "../fixtures/base";
import { SettingsPage } from "../pages/settings.page";

test.describe("Settings", () => {
  let settings: SettingsPage;

  test.beforeEach(async ({ page }) => {
    settings = new SettingsPage(page);
    await settings.goto();
  });

  test("shows page heading", async () => {
    await expect(settings.heading).toBeVisible();
  });

  test("shows all settings cards", async () => {
    await expect(settings.financialCard).toBeVisible();
    await expect(settings.reminderCard).toBeVisible();
    await expect(settings.dataManagementCard).toBeVisible();
    await expect(settings.mcpCard).toBeVisible();
  });

  test("shows export and import buttons", async () => {
    await expect(settings.exportButton).toBeVisible();
    await expect(settings.importButton).toBeVisible();
  });

  test("shows MCP toggle", async () => {
    await expect(settings.mcpToggle).toBeVisible();
  });

  test("annual income field has default value", async () => {
    // Settings form loads with default value 600000
    await expect(settings.annualIncomeInput).toHaveValue("600000");
  });

  test("save button changes to saved state after click", async ({ page }) => {
    // Note: financial settings save is client-side only (not persisted to DB yet)
    await settings.annualIncomeInput.fill("800000");
    await settings.saveButton.click();

    // Button should briefly show "已保存"
    await expect(
      page.getByRole("button", { name: "已保存" })
    ).toBeVisible();
  });
});
