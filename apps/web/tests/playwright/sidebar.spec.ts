import type { Locator } from "@playwright/test";
import { expect, test } from "./fixtures";

async function resolveCssColor(locator: Locator, value: string): Promise<string> {
	return locator.evaluate((element, color) => {
		const probe = document.createElement("span");
		probe.style.backgroundColor = color;
		element.append(probe);
		const result = getComputedStyle(probe).backgroundColor;
		probe.remove();
		return result;
	}, value);
}

async function expectBackground(locator: Locator, value: string) {
	const expected = await resolveCssColor(locator, value);
	await expect(locator).toHaveCSS("background-color", expected);
}

/** Basalt paints row hover on the nav list ::before layer, not per-link backgrounds. */
async function expectBasaltNavHover(nav: Locator, link: Locator, token: string) {
	await link.hover();
	await expect(nav).toHaveAttribute("data-hover-visible", "true");
	const expected = await resolveCssColor(nav, token);
	const surface = await nav.evaluate((el) => getComputedStyle(el, "::before").backgroundColor);
	expect(surface).toBe(expected);
}

for (const colorScheme of ["light", "dark"] as const) {
	test.describe(`${colorScheme} sidebar`, () => {
		test.use({ colorScheme, reducedMotion: "reduce" });

		test("avatar stays 36px at equal y after collapse", async ({ page }, testInfo) => {
			await page.goto("/");
			const sidebar = page.getByRole("complementary", { name: "主导航", exact: true });
			const avatar = sidebar.locator('[data-slot="sidebar-user"] .h-basalt-9');
			const email = sidebar.locator('[data-slot="sidebar-user"] p').last();
			await expect(sidebar).toHaveCSS("width", "260px");
			await expect(avatar).toHaveCSS("width", "36px");
			await expect(avatar).toHaveCSS("height", "36px");
			await expect(email).toHaveCSS("line-height", "16px");
			const expanded = await avatar.boundingBox();
			expect(expanded).not.toBeNull();
			await testInfo.attach("expanded-sidebar", {
				body: await sidebar.screenshot({ path: testInfo.outputPath("expanded-sidebar.png") }),
				contentType: "image/png",
			});
			await sidebar.getByRole("button", { name: "收起侧边栏", exact: true }).click();
			await page.mouse.move(1000, 100);
			await expect(sidebar).toHaveCSS("width", "68px");
			await expect(avatar).toHaveCSS("width", "36px");
			await expect(avatar).toHaveCSS("height", "36px");
			const collapsed = await avatar.boundingBox();
			expect(collapsed).not.toBeNull();
			expect(collapsed?.y).toBe(expanded?.y);
			await expect(sidebar.locator('[data-slot="sidebar-brand-copy"]')).toBeHidden();
			console.log(JSON.stringify({ colorScheme, expanded, collapsed, emailLineHeight: "16px" }));
			await testInfo.attach("avatar-geometry", {
				body: JSON.stringify({ expanded, collapsed, emailLineHeight: "16px" }),
				contentType: "application/json",
			});
			await testInfo.attach("collapsed-sidebar", {
				body: await sidebar.screenshot({ path: testInfo.outputPath("collapsed-sidebar.png") }),
				contentType: "image/png",
			});
		});

		for (const width of [390, 700]) {
			test(`mobile drawer geometry at ${width}px`, async ({ page }, testInfo) => {
				await page.setViewportSize({ width, height: 844 });
				await page.goto("/");
				const openNavigation = page.getByRole("button", {
					name: "打开导航菜单",
					exact: true,
					includeHidden: true,
				});
				await expect(openNavigation).toHaveAttribute("aria-expanded", "false");
				await openNavigation.click();
				const drawer = page.locator('[data-slot="sidebar-drawer"]');
				await expect(drawer).toBeVisible();
				await expect(openNavigation).toHaveAttribute("aria-expanded", "true");
				await expect(drawer).toHaveAttribute(
					"id",
					(await openNavigation.getAttribute("aria-controls")) ?? "",
				);
				await expect(drawer).toHaveCSS("width", "320px");
				await expect(drawer.locator("[data-basalt-sidebar]")).toHaveCSS("width", "260px");
				await expect(drawer).toHaveCSS("padding-left", "0px");
				await expect(drawer).toHaveCSS("padding-right", "0px");
				await testInfo.attach("drawer", {
					body: await page.screenshot({ path: testInfo.outputPath("drawer.png") }),
					contentType: "image/png",
				});
			});
		}

		test("expanded collapse toggle aligns with nav group chevrons", async ({ page }) => {
			await page.goto("/");
			const sidebar = page.getByRole("complementary", { name: "主导航", exact: true });
			const toggleIcon = sidebar
				.getByRole("button", { name: "收起侧边栏", exact: true })
				.locator("svg");
			const chevronIcon = sidebar.locator("nav svg.lucide-chevron-up").first();

			await expect(toggleIcon).toBeVisible();
			await expect(chevronIcon).toBeVisible();

			const toggleBox = await toggleIcon.boundingBox();
			const chevronBox = await chevronIcon.boundingBox();
			if (!toggleBox || !chevronBox) {
				throw new Error("Expected toggle and chevron icons to have layout boxes");
			}

			const toggleCenterX = toggleBox.x + toggleBox.width / 2;
			const chevronCenterX = chevronBox.x + chevronBox.width / 2;
			expect(Math.abs(toggleCenterX - chevronCenterX)).toBeLessThanOrEqual(0.5);
		});

		test("expanded links keep distinct Basalt selected and hover colors", async ({ page }) => {
			await page.goto("/");
			const sidebar = page.getByRole("complementary", { name: "主导航", exact: true });
			const nav = sidebar.locator('[data-slot="sidebar-nav"]');
			const active = sidebar.getByRole("link", { name: "仪表盘", exact: true });
			const members = sidebar.getByRole("link", { name: "家庭成员", exact: true });
			await expect(active).toHaveAttribute("aria-current", "page");
			await expectBackground(sidebar, "hsl(var(--basalt-background))");
			await expectBackground(active, "hsl(var(--basalt-selected))");
			await expectBasaltNavHover(nav, members, "var(--basalt-hover)");
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
			const nav = sidebar.locator('[data-slot="sidebar-nav"]');
			await expect(sidebar).toHaveCSS("width", "68px");
			const active = sidebar.getByRole("link", { name: "仪表盘", exact: true });
			const members = sidebar.getByRole("link", { name: "家庭成员", exact: true });
			await expect(active).toHaveAttribute("aria-current", "page");
			await expectBackground(active, "hsl(var(--basalt-selected))");
			await expectBasaltNavHover(nav, members, "var(--basalt-hover)");
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

		test("expanded footer signs out through Access and the rail hides it", async ({ page }) => {
			await page.goto("/");
			const sidebar = page.getByRole("complementary", { name: "主导航", exact: true });
			const signOut = sidebar.getByRole("link", { name: "退出登录", exact: true });
			await expect(signOut).toHaveAttribute(
				"href",
				"https://nocoo.cloudflareaccess.com/cdn-cgi/access/logout",
			);
			await signOut.hover();
			await expect(page.getByRole("tooltip", { name: "退出登录" })).toBeVisible();
			await page.getByRole("button", { name: "收起侧边栏", exact: true }).click();
			await expect(sidebar).toHaveCSS("width", "68px");
			await expect(sidebar.getByRole("link", { name: "退出登录", exact: true })).toHaveCount(0);
		});

		test("mobile drawer dismiss button and first Escape close it", async ({ page }) => {
			await page.setViewportSize({ width: 390, height: 844 });
			await page.goto("/");
			const openNavigation = page.getByRole("button", { name: "打开导航菜单", exact: true });
			await openNavigation.click();
			const drawer = page.getByRole("dialog");
			const dismiss = drawer.getByRole("button", { name: "关闭导航菜单", exact: true });
			await expect(dismiss).toBeVisible();
			await dismiss.click();
			await expect(drawer).toBeHidden();
			await expect(openNavigation).toBeFocused();
			await openNavigation.click();
			await dismiss.focus();
			await expect(page.getByRole("tooltip")).toHaveCount(0);
			await page.keyboard.press("Escape");
			await expect(drawer).toBeHidden();
			await expect(openNavigation).toBeFocused();
		});
	});
}
