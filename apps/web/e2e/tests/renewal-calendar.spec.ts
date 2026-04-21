import { test, expect } from "../fixtures/base";
import { RenewalCalendarPage } from "../pages/renewal-calendar.page";

test.describe("Renewal Calendar", () => {
  let calendar: RenewalCalendarPage;

  test.beforeEach(async ({ page }) => {
    calendar = new RenewalCalendarPage(page);
    await calendar.goto();
  });

  test("shows page heading and subtitle", async () => {
    await expect(calendar.heading).toBeVisible();
    await expect(calendar.subtitle).toBeVisible();
  });

  test("shows summary cards", async ({ page }) => {
    // 4 summary cards: total premium, policy count, savings, protection
    await expect(page.getByText("未来一年续保总额")).toBeVisible();
    await expect(page.getByText("涉及保单")).toBeVisible();
    await expect(page.getByText("储蓄险保费")).toBeVisible();
    await expect(page.getByText("保障险保费")).toBeVisible();
  });

  test("shows monthly details section", async () => {
    await expect(calendar.monthlyDetailsHeading).toBeVisible();
  });
});
