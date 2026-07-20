import { expect, test } from "./fixtures";

test.describe
	.serial("insurers CRUD", () => {
		test("page renders with H1 and table", async ({ page }) => {
			await page.goto("/insurers");
			await expect(page.getByRole("heading", { level: 1, name: "保险公司" })).toBeVisible({
				timeout: 10_000,
			});
			await expect(page.getByRole("table")).toBeVisible({ timeout: 10_000 });
		});

		test("seeded insurer is visible", async ({ page }) => {
			await page.goto("/insurers");
			await expect(page.getByText("L3测试保险公司")).toBeVisible({ timeout: 10_000 });
		});

		test("create a new insurer", async ({ page }) => {
			await page.goto("/insurers");
			await page.getByRole("button", { name: "添加保险公司" }).click();
			await expect(page.getByRole("heading", { name: "添加保险公司" })).toBeVisible({
				timeout: 10_000,
			});

			await page.getByLabel("公司名称").fill("L3新增保险");
			await page.getByLabel("客服电话").fill("400-999-8888");
			await page.getByRole("button", { name: "添加", exact: true }).click();

			await expect(page.getByText("L3新增保险")).toBeVisible({ timeout: 10_000 });
		});

		test("edit the new insurer", async ({ page }) => {
			await page.goto("/insurers");
			const row = page.getByRole("row", { name: /L3新增保险/ });
			await row.getByRole("button", { name: "编辑" }).click();

			await expect(page.getByRole("heading", { name: "编辑保险公司" })).toBeVisible({
				timeout: 10_000,
			});

			const nameInput = page.getByLabel("公司名称");
			await nameInput.fill("L3编辑后保险");
			await page.getByRole("button", { name: "保存修改" }).click();

			await expect(page.getByText("L3编辑后保险")).toBeVisible({ timeout: 10_000 });
			await expect(page.getByText("L3新增保险", { exact: true })).toHaveCount(0, {
				timeout: 10_000,
			});
		});

		test("delete the edited insurer", async ({ page }) => {
			page.on("dialog", (d) => {
				void d.accept();
			});
			await page.goto("/insurers");
			const row = page.getByRole("row", { name: /L3编辑后保险/ });
			await row.getByRole("button", { name: "删除保险公司" }).click();

			await expect(page.getByRole("alertdialog").getByText("确认删除")).toBeVisible({
				timeout: 10_000,
			});
			await page
				.getByRole("alertdialog")
				.getByRole("button", { name: "删除", exact: true })
				.click();

			await expect(page.getByText("L3编辑后保险")).toHaveCount(0, {
				timeout: 10_000,
			});
		});
	});
