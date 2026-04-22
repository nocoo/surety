import { test, expect } from "./fixtures";

test("dashboard renders summary after SWR loads seeded data", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "仪表盘" })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText("家庭保障概览")).toBeVisible();
});
