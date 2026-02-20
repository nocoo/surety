import type { Page } from "@playwright/test";

export class CoverageLookupPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/coverage-lookup");
    await this.page.waitForLoadState("networkidle");
  }

  get heading() {
    return this.page.getByRole("heading", { name: "保障速查" });
  }

  /** Member tab button */
  get memberTab() {
    return this.page.getByRole("button", { name: /家庭成员/ });
  }

  /** Asset tab button */
  get assetTab() {
    return this.page.getByRole("button", { name: /资产/ }).last();
  }

  /** Select a member by name in the horizontal scroll */
  memberCard(name: string) {
    return this.page.locator("button").filter({ hasText: name });
  }

  /** Select an asset by name in the horizontal scroll */
  assetCard(name: string) {
    return this.page.locator("button").filter({ hasText: name });
  }

  /** Show inactive toggle */
  get showInactiveToggle() {
    return this.page.locator("#show-inactive");
  }

  /** Category section headings */
  categorySection(label: string) {
    return this.page.getByText(label);
  }

  /** Empty state message */
  get emptyMessage() {
    return this.page.getByText(/暂无保单记录/);
  }
}
