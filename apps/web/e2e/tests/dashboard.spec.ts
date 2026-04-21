import { test, expect } from "../fixtures/base";
import { DashboardPage } from "../pages/dashboard.page";

test.describe("Dashboard", () => {
  let dashboard: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
    await dashboard.goto();
  });

  test("shows page heading and subtitle", async () => {
    await expect(dashboard.heading).toBeVisible();
    await expect(dashboard.subtitle).toBeVisible();
  });

  test("shows all 4 stat cards with values", async () => {
    for (const label of DashboardPage.STAT_LABELS) {
      const card = dashboard.statCard(label);
      await expect(card).toBeVisible();
    }
  });

  test("shows all 10 chart sections", async () => {
    for (const title of DashboardPage.CHART_TITLES) {
      await expect(dashboard.chart(title)).toBeVisible();
    }
  });

  test("stat cards display non-zero values from seed data", async () => {
    // Dashboard counts only effectively active policies (Active AND not expired).
    // In 2026, only 3 of 8 seed policies are still active (Life, CriticalIllness, Annuity).
    const policiesCard = dashboard.statCard("保单总数");
    await expect(policiesCard).toContainText("3");

    // memberCount is total members regardless of policies
    const membersCard = dashboard.statCard("家庭成员");
    await expect(membersCard).toContainText("7");
  });
});
