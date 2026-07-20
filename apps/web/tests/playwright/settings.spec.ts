import { expect, test } from "./fixtures";

test.describe
	.serial("settings page", () => {
		test("renders heading and basic form fields", async ({ page }) => {
			await page.goto("/settings");
			await expect(page.getByRole("heading", { level: 1, name: "设置" })).toBeVisible({
				timeout: 10_000,
			});
			await expect(page.getByLabel("家庭年收入 (元)")).toBeVisible({
				timeout: 10_000,
			});
			await expect(page.getByText("货币单位")).toBeVisible();
			await expect(page.getByText("提前提醒天数")).toBeVisible();
		});

		test("loads default values from settings API", async ({ page }) => {
			await page.goto("/settings");
			const incomeInput = page.getByLabel("家庭年收入 (元)");
			await expect(incomeInput).toBeVisible({ timeout: 10_000 });
			await expect(incomeInput).not.toHaveValue("", { timeout: 10_000 });
		});

		test("modifies annual income and saves successfully", async ({ page }) => {
			await page.goto("/settings");
			const incomeInput = page.getByLabel("家庭年收入 (元)");
			await expect(incomeInput).toBeVisible({ timeout: 10_000 });
			await incomeInput.fill("888888");
			await page.getByRole("button", { name: /保存设置|保存中/ }).click();
			await expect(page.getByRole("button", { name: "已保存" })).toBeVisible({ timeout: 10_000 });
		});

		test("modifies reminder days and saves successfully", async ({ page }) => {
			await page.goto("/settings");
			await expect(page.getByLabel("家庭年收入 (元)")).toBeVisible({
				timeout: 10_000,
			});
			const reminderTrigger = page.locator("button[role=combobox]").filter({ hasText: /天$/ });
			await reminderTrigger.click();
			await page.getByRole("option", { name: "60 天" }).click();
			await page.getByRole("button", { name: /保存设置|保存中/ }).click();
			await expect(page.getByRole("button", { name: "已保存" })).toBeVisible({ timeout: 10_000 });
		});

		test("modifies currency and saves successfully", async ({ page }) => {
			await page.goto("/settings");
			await expect(page.getByLabel("家庭年收入 (元)")).toBeVisible({
				timeout: 10_000,
			});
			const currencyTrigger = page
				.locator("button[role=combobox]")
				.filter({ hasText: /(人民币|美元|港币)/ });
			await currencyTrigger.click();
			await page.getByRole("option", { name: "美元 (USD)" }).click();
			await page.getByRole("button", { name: /保存设置|保存中/ }).click();
			await expect(page.getByRole("button", { name: "已保存" })).toBeVisible({ timeout: 10_000 });
		});

		test("persists saved values across page reload", async ({ page }) => {
			await page.goto("/settings");
			const incomeInput = page.getByLabel("家庭年收入 (元)");
			await expect(incomeInput).toBeVisible({ timeout: 10_000 });
			await expect(incomeInput).toHaveValue("888888", { timeout: 10_000 });
			await expect(
				page.locator("button[role=combobox]").filter({ hasText: "美元 (USD)" }),
			).toBeVisible({ timeout: 10_000 });
			await expect(page.locator("button[role=combobox]").filter({ hasText: "60 天" })).toBeVisible({
				timeout: 10_000,
			});
		});
	});
