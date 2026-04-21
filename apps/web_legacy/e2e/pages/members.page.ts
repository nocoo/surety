import type { Page } from "@playwright/test";

export class MembersPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/members");
    await this.page.waitForLoadState("networkidle");
  }

  get heading() {
    return this.page.getByRole("heading", { name: "家庭成员" });
  }

  get addButton() {
    return this.page.getByRole("button", { name: "添加成员" });
  }

  get table() {
    return this.page.locator("table");
  }

  /** All table rows (data rows only, not header) */
  get rows() {
    return this.page.locator("tbody tr");
  }

  /** Get a row by member name */
  row(name: string) {
    return this.rows.filter({ hasText: name });
  }

  /** Edit button within a row */
  editButton(name: string) {
    return this.row(name).getByRole("button", { name: "编辑" });
  }

  /** Delete button within a row */
  deleteButton(name: string) {
    return this.row(name).getByRole("button", { name: "删除" });
  }

  /** Member count text */
  get memberCount() {
    return this.page.getByText(/共 \d+ 位成员/);
  }

  // -- Sheet form --

  get sheet() {
    return this.page.locator('[data-slot="sheet-content"]');
  }

  get sheetTitle() {
    return this.sheet.locator('[data-slot="sheet-title"]');
  }

  get nameInput() {
    return this.page.locator("#name");
  }

  get birthDateInput() {
    return this.page.locator("#birthDate");
  }

  get phoneInput() {
    return this.page.locator("#phone");
  }

  /** Select a relation in the sheet form */
  async selectRelation(label: string) {
    // Click the trigger that has "选择关系" or current value
    const trigger = this.sheet
      .locator('[data-slot="select-trigger"]')
      .first();
    await trigger.click();
    await this.page.getByRole("option", { name: label }).click();
  }

  /** Select a gender in the sheet form */
  async selectGender(label: string) {
    const trigger = this.sheet
      .locator('[data-slot="select-trigger"]')
      .nth(1);
    await trigger.click();
    await this.page.getByRole("option", { name: label }).click();
  }

  get submitButton() {
    return this.sheet.getByRole("button", { name: /添加成员|保存修改/ });
  }

  get cancelButton() {
    return this.sheet.getByRole("button", { name: "取消" });
  }

  // -- Delete dialog --

  get deleteDialog() {
    return this.page.locator('[data-slot="alert-dialog-content"]');
  }

  get deleteConfirmButton() {
    return this.deleteDialog.getByRole("button", { name: "删除" });
  }

  get deleteCancelButton() {
    return this.deleteDialog.getByRole("button", { name: "取消" });
  }

  // -- Helper actions --

  async fillMemberForm(data: {
    name: string;
    relation: string;
    gender: string;
    birthDate: string;
    phone?: string;
  }) {
    await this.nameInput.fill(data.name);
    await this.selectRelation(data.relation);
    await this.selectGender(data.gender);
    await this.birthDateInput.fill(data.birthDate);
    if (data.phone) {
      await this.phoneInput.fill(data.phone);
    }
  }
}
