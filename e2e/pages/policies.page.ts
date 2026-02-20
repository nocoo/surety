import type { Page } from "@playwright/test";

export class PoliciesPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/policies");
    await this.page.waitForLoadState("networkidle");
  }

  get heading() {
    return this.page.getByRole("heading", { name: "全部保单" });
  }

  get addButton() {
    return this.page.getByRole("button", { name: "添加保单" });
  }

  get table() {
    return this.page.locator("table");
  }

  get rows() {
    return this.page.locator("tbody tr");
  }

  /** Get a row by product name */
  row(productName: string) {
    return this.rows.filter({ hasText: productName });
  }

  /** Edit button within a row */
  editButton(productName: string) {
    return this.row(productName).getByRole("button", { name: "编辑", exact: true });
  }

  /** Delete button within a row */
  deleteButton(productName: string) {
    return this.row(productName).getByRole("button", { name: "删除", exact: true });
  }

  /** Policy count text */
  get policyCount() {
    return this.page.getByText(/共 \d+ 份保单/);
  }

  // -- Filter controls --

  get clearFiltersButton() {
    return this.page.getByRole("button", { name: "清除筛选" });
  }

  /** View mode toggle buttons */
  get listViewToggle() {
    return this.page.getByRole("radio", { name: "列表视图" });
  }

  get byCategoryToggle() {
    return this.page.getByRole("radio", { name: "按类型分组" });
  }

  get byInsuredToggle() {
    return this.page.getByRole("radio", { name: "按被保人分组" });
  }

  // -- Sheet form --

  get sheet() {
    return this.page.locator('[data-slot="sheet-content"]');
  }

  get sheetTitle() {
    return this.sheet.locator('[data-slot="sheet-title"]');
  }

  get productNameInput() {
    return this.page.locator("#productName");
  }

  get insurerNameInput() {
    return this.page.locator("#insurerName");
  }

  get policyNumberInput() {
    return this.page.locator("#policyNumber");
  }

  get sumAssuredInput() {
    return this.page.locator("#sumAssured");
  }

  get premiumInput() {
    return this.page.locator("#premium");
  }

  get effectiveDateInput() {
    return this.page.locator("#effectiveDate");
  }

  /** Select a category in the sheet form */
  async selectCategory(label: string) {
    const triggers = this.sheet.locator('[data-slot="select-trigger"]');
    // Category is the first select after policyNumber row
    await triggers.filter({ hasText: /选择险种|寿险|重疾险|医疗险|意外险|年金险|财产险/ }).first().click();
    await this.page.getByRole("option", { name: label }).click();
  }

  /** Select an applicant member */
  async selectApplicant(name: string) {
    const triggers = this.sheet.locator('[data-slot="select-trigger"]');
    await triggers.filter({ hasText: /选择投保人/ }).first().click();
    await this.page.getByRole("option", { name }).click();
  }

  /** Select an insured member */
  async selectInsured(name: string) {
    const triggers = this.sheet.locator('[data-slot="select-trigger"]');
    await triggers.filter({ hasText: /选择家庭成员/ }).first().click();
    await this.page.getByRole("option", { name }).click();
  }

  get submitButton() {
    return this.sheet.getByRole("button", { name: /创建保单|保存修改/ });
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

  // -- Detail dialog --

  get detailDialog() {
    return this.page.locator('[data-slot="dialog-content"]');
  }

  // -- Helper actions --

  async fillPolicyForm(data: {
    productName: string;
    insurerName: string;
    policyNumber: string;
    category: string;
    sumAssured: string;
    premium: string;
    effectiveDate: string;
    applicant?: string;
    insured?: string;
  }) {
    await this.productNameInput.fill(data.productName);
    await this.insurerNameInput.fill(data.insurerName);
    await this.policyNumberInput.fill(data.policyNumber);
    await this.selectCategory(data.category);
    await this.sumAssuredInput.fill(data.sumAssured);
    await this.premiumInput.fill(data.premium);
    await this.effectiveDateInput.fill(data.effectiveDate);
    if (data.applicant) {
      await this.selectApplicant(data.applicant);
    }
    if (data.insured) {
      await this.selectInsured(data.insured);
    }
  }
}
