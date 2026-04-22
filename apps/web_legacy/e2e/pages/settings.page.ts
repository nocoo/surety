import type { Page } from "@playwright/test";

export class SettingsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/settings");
    await this.page.waitForLoadState("networkidle");
  }

  get heading() {
    return this.page.getByRole("heading", { name: "设置", exact: true });
  }

  get annualIncomeInput() {
    return this.page.locator("#annualIncome");
  }

  get saveButton() {
    return this.page.getByRole("button", { name: /保存设置|已保存/ });
  }

  get exportButton() {
    return this.page.getByRole("button", { name: "导出 JSON 备份" });
  }

  get importButton() {
    return this.page.getByRole("button", { name: "导入 JSON 备份" });
  }

  /** Card headings (use getByRole to avoid matching description text) */
  get financialCard() {
    return this.page.getByRole("heading", { name: "家庭财务" });
  }

  get reminderCard() {
    return this.page.getByRole("heading", { name: "提醒设置" });
  }

  get dataManagementCard() {
    return this.page.getByRole("heading", { name: "数据管理" });
  }
}
