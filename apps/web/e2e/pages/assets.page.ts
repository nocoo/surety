import type { Page } from "@playwright/test";

export class AssetsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/assets");
    await this.page.waitForLoadState("networkidle");
  }

  get heading() {
    return this.page.getByRole("heading", { name: "资产管理" });
  }

  get addButton() {
    return this.page.getByRole("button", { name: "添加资产" });
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

  get assetCount() {
    return this.page.getByText(/共 \d+ 项资产/);
  }

  // -- Sheet form --

  get sheet() {
    return this.page.locator('[data-slot="sheet-content"]');
  }

  get nameInput() {
    return this.page.locator("#name");
  }

  get identifierInput() {
    return this.page.locator("#identifier");
  }

  get submitButton() {
    return this.sheet.getByRole("button", { name: /添加资产|保存修改/ });
  }

  // -- Delete dialog --

  get deleteDialog() {
    return this.page.locator('[data-slot="alert-dialog-content"]');
  }

  get deleteConfirmButton() {
    return this.deleteDialog.getByRole("button", { name: "删除" });
  }
}
