import type { Page } from "@playwright/test";

export class RenewalCalendarPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/renewal-calendar");
    await this.page.waitForLoadState("networkidle");
  }

  get heading() {
    return this.page.getByRole("heading", { name: "续保日历" });
  }

  get subtitle() {
    return this.page.getByText("未来 12 个月的保单续保计划");
  }

  /** Summary card labels */
  get summaryCards() {
    return this.page.locator(".rounded-card");
  }

  /** Monthly details heading */
  get monthlyDetailsHeading() {
    return this.page.getByRole("heading", { name: "月度明细" });
  }
}
