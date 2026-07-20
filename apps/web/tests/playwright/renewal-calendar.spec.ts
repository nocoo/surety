import { expect, test } from "./fixtures";

test("renewal calendar page renders heading and summary cards", async ({ page }) => {
	await page.goto("/renewal-calendar");
	await expect(page.getByRole("heading", { level: 1, name: "续保日历" })).toBeVisible({
		timeout: 10_000,
	});
	await expect(page.getByText("未来一年续保总额")).toBeVisible({
		timeout: 10_000,
	});
	await expect(page.getByText("涉及保单")).toBeVisible();
	await expect(page.getByText("储蓄险保费")).toBeVisible();
	await expect(page.getByText("保障险保费")).toBeVisible();
});

test("summary card shows non-empty data from seeded policy", async ({ page }) => {
	await page.goto("/renewal-calendar");
	const totalCountCard = page
		.locator("div", { hasText: "涉及保单" })
		.filter({ hasText: /\d+\s*份/ })
		.first();
	await expect(totalCountCard).toBeVisible({ timeout: 10_000 });
});

test("monthly chart component renders", async ({ page }) => {
	await page.goto("/renewal-calendar");
	await expect(page.getByRole("heading", { level: 1, name: "续保日历" })).toBeVisible({
		timeout: 10_000,
	});
	await expect(page.locator("svg.recharts-surface").first()).toBeVisible({
		timeout: 10_000,
	});
});

test("monthly details section renders", async ({ page }) => {
	await page.goto("/renewal-calendar");
	await expect(page.getByRole("heading", { level: 2, name: "月度明细" })).toBeVisible({
		timeout: 10_000,
	});
});
