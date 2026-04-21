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

  test("save button persists financial settings", async ({ page }) => {
    await settings.annualIncomeInput.fill("800000");
    await settings.saveButton.click();

    await expect(
      page.getByRole("button", { name: "已保存" })
    ).toBeVisible();

    await page.reload();
    await expect(settings.annualIncomeInput).toHaveValue("800000");
  });
});
