import type { Page } from "@playwright/test";

export class DashboardPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/");
    await this.page.waitForLoadState("networkidle");
  }

  /** Page heading */
  get heading() {
    return this.page.getByRole("heading", { name: "仪表盘" });
  }

  /** Subtitle */
  get subtitle() {
    return this.page.getByText("家庭保障概览");
  }

  /** Get stat card by label text */
  statCard(label: string) {
    return this.page.locator(".rounded-card").filter({ hasText: label });
  }

  /** Chart sections - by title */
  chart(title: string) {
    return this.page.getByText(title);
  }

  /** All chart titles expected on dashboard */
  static readonly CHART_TITLES = [
    "保费构成",
    "成员保费分布",
    "保障额度构成",
    "成员保障额度",
    "险种构成",
    "成员险种分布",
    "续费时间分布",
    "到期时间分布",
    "保险公司分布",
    "渠道分布",
  ];

  /** Stat card labels (must match createStatCards() in dashboard-vm.ts) */
  static readonly STAT_LABELS = [
    "保单总数",
    "家庭成员",
    "年保费",
    "总保额",
  ];
}
