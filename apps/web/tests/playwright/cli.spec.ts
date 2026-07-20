import { expect, test } from "./fixtures";

test.describe("CLI page", () => {
	test("renders heading and description", async ({ page }) => {
		await page.goto("/cli");
		await expect(page.getByRole("heading", { level: 1, name: "CLI" })).toBeVisible({
			timeout: 10_000,
		});
		await expect(page.getByText("是 AI 助手与脚本访问 Surety 的命令行入口")).toBeVisible();
	});

	test("install and usage section renders", async ({ page }) => {
		await page.goto("/cli");
		await expect(page.getByRole("heading", { name: "安装与使用" })).toBeVisible({
			timeout: 10_000,
		});
		await expect(page.getByText("bun add -g @nocoo/surety")).toBeVisible();
		await expect(page.getByText("surety whoami")).toBeVisible();
		await expect(page.getByText("surety members list")).toBeVisible();
	});

	test("auth mechanism section renders", async ({ page }) => {
		await page.goto("/cli");
		await expect(page.getByRole("heading", { name: "认证机制" })).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText("双域名分离")).toBeVisible();
		await expect(page.getByText("域名职责")).toBeVisible();
		await expect(page.getByText("配置文件位置")).toBeVisible();
	});

	test("token management section renders", async ({ page }) => {
		await page.goto("/cli");
		await expect(page.getByRole("heading", { name: "Token 管理" })).toBeVisible({
			timeout: 10_000,
		});
		await expect(page.getByText("查看和撤销当前账号下的所有 API token")).toBeVisible();
	});
});
