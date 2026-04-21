import type { Page } from "@playwright/test";

export class InsurersPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/insurers");
    await this.page.waitForLoadState("networkidle");
  }

  get heading() {
    return this.page.getByRole("heading", { name: "保险公司" });
  }

  get addButton() {
    return this.page.getByRole("button", { name: "添加保险公司" });
  }

  get rows() {
    return this.page.locator("tbody tr");
  }

  row(name: string) {
    return this.rows.filter({ hasText: name });
  }

  editButton(name: string) {
    return this.row(name).getByRole("button", { name: "编辑" });
  }

  deleteButton(name: string) {
    return this.row(name).getByRole("button", { name: "删除" });
  }

  get insurerCount() {
    return this.page.getByText(/共 \d+ 家保险公司/);
  }

  // -- Sheet form --

  get sheet() {
    return this.page.locator('[data-slot="sheet-content"]');
  }

  get nameInput() {
    return this.page.locator("#name");
  }

  get phoneInput() {
    return this.page.locator("#phone");
  }

  get websiteInput() {
    return this.page.locator("#website");
  }

  get submitButton() {
    return this.sheet.getByRole("button", { name: /添加|保存修改/ });
  }

  // -- Delete dialog --

  get deleteDialog() {
    return this.page.locator('[data-slot="alert-dialog-content"]');
  }

  get deleteConfirmButton() {
    return this.deleteDialog.getByRole("button", { name: "删除" });
  }
}
