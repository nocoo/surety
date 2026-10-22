import type { Locator } from "@playwright/test";
import { expect, test } from "./fixtures";

async function expectBackground(locator: Locator, value: string) {
	const expected = await locator.evaluate((element, color) => {
		const probe = document.createElement("span");
		probe.style.backgroundColor = color;
		element.append(probe);
		const result = getComputedStyle(probe).backgroundColor;
		probe.remove();
		return result;
	}, value);
	await expect(locator).toHaveCSS("background-color", expected);
}

for (const colorScheme of ["light", "dark"] as const) {
	test.describe(`${colorScheme} sidebar`, () => {
		test.use({ colorScheme, reducedMotion: "reduce" });

		test("expanded links keep distinct Basalt selected and hover colors", async ({ page }) => {
			await page.goto("/");
			const sidebar = page.getByRole("complementary", { name: "主导航", exact: true });
			const active = sidebar.getByRole("link", { name: "仪表盘", exact: true });
			const members = sidebar.getByRole("link", { name: "家庭成员", exact: true });
			await expect(active).toHaveAttribute("aria-current", "page");
			await expectBackground(sidebar, "hsl(var(--basalt-background))");
			await expectBackground(active, "hsl(var(--basalt-selected))");
			await members.hover();
			await expectBackground(members, "var(--basalt-hover)");
			await expectBackground(active, "hsl(var(--basalt-selected))");
			await active.hover();
			await expectBackground(active, "hsl(var(--basalt-selected))");
			await expect(members).toHaveAttribute("href", "/members");
			await members.click();
			await expect(page).toHaveURL(/\/members$/);
			await expect(members).toHaveAttribute("aria-current", "page");
			await expect(active).not.toHaveAttribute("aria-current");
			await expectBackground(members, "hsl(var(--basalt-selected))");
		});

		test("collapsed links retain the same colors and accessible names", async ({ page }) => {
			await page.goto("/");
			await page.getByRole("button", { name: "收起侧边栏", exact: true }).click();
			const sidebar = page.getByRole("complementary", { name: "主导航", exact: true });
			await expect(sidebar).toHaveCSS("width", "68px");
			const active = sidebar.getByRole("link", { name: "仪表盘", exact: true });
			const members = sidebar.getByRole("link", { name: "家庭成员", exact: true });
			await expect(active).toHaveAttribute("aria-current", "page");
			await expectBackground(active, "hsl(var(--basalt-selected))");
			await members.hover();
			await expectBackground(members, "var(--basalt-hover)");
			await expectBackground(active, "hsl(var(--basalt-selected))");
			await expect(members).toHaveAttribute("href", "/members");
		});

		test("mobile drawer uses shared colors and closes after navigation", async ({ page }) => {
			await page.setViewportSize({ width: 390, height: 844 });
			await page.goto("/");
			await page.getByRole("button", { name: "打开导航菜单", exact: true }).click();
			const sidebar = page.getByRole("complementary", { name: "主导航抽屉", exact: true });
			const active = sidebar.getByRole("link", { name: "仪表盘", exact: true });
			await expectBackground(sidebar, "hsl(var(--basalt-background))");
			await expectBackground(active, "hsl(var(--basalt-selected))");
			await sidebar.getByRole("link", { name: "家庭成员", exact: true }).click();
			await expect(page).toHaveURL(/\/members$/);
			await expect(page.getByRole("dialog")).toBeHidden();
		});
	});
}
