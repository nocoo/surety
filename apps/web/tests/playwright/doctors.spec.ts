import { expect, test } from "./fixtures";

test.describe
	.serial("doctors page", () => {
		test("renders the doctors page with header and table", async ({ page }) => {
			await page.goto("/doctors");
			await expect(page.getByRole("heading", { level: 1, name: "医生管理" })).toBeVisible({
				timeout: 10_000,
			});
			await expect(page.getByRole("table")).toBeVisible({ timeout: 10_000 });
		});

		test("shows the seeded doctor", async ({ page }) => {
			await page.goto("/doctors");
			await expect(page.getByRole("cell", { name: "L3测试医生" })).toBeVisible({
				timeout: 10_000,
			});
		});

		test("creates a new doctor", async ({ page }) => {
			await page.goto("/doctors");
			await page.getByRole("button", { name: "添加医生" }).click();
			await expect(page.getByRole("heading", { name: "添加医生" })).toBeVisible({
				timeout: 10_000,
			});

			await page.getByLabel("医生姓名").fill("L3新增医生");

			await page.getByRole("combobox", { name: "所属医院" }).click();
			await page.getByRole("option", { name: "L3测试医院" }).click();

			await page.getByLabel("科室").fill("外科");

			await page.getByRole("combobox", { name: "职称" }).click();
			await page.getByRole("option", { name: "主任医师" }).first().click();

			await page.getByRole("button", { name: "添加", exact: true }).click();

			await expect(page.getByRole("heading", { name: "添加医生" })).toBeHidden({ timeout: 10_000 });
			await expect(page.getByRole("cell", { name: "L3新增医生" })).toBeVisible({
				timeout: 10_000,
			});
		});

		test("edits an existing doctor", async ({ page }) => {
			await page.goto("/doctors");
			const row = page.getByRole("row").filter({ hasText: "L3新增医生" });
			await row.getByRole("button", { name: "编辑" }).click();

			await expect(page.getByRole("heading", { name: "编辑医生" })).toBeVisible({
				timeout: 10_000,
			});

			await page.getByLabel("科室").fill("骨科");
			await page.getByRole("button", { name: "保存修改" }).click();

			await expect(page.getByRole("heading", { name: "编辑医生" })).toBeHidden({ timeout: 10_000 });

			const editedRow = page.getByRole("row").filter({ hasText: "L3新增医生" });
			await expect(editedRow).toContainText("骨科", { timeout: 10_000 });
		});

		test("deletes a doctor", async ({ page }) => {
			page.on("dialog", (d) => d.accept());
			await page.goto("/doctors");

			const row = page.getByRole("row").filter({ hasText: "L3新增医生" });
			await row.getByRole("button", { name: "删除医生" }).click();

			await expect(page.getByRole("alertdialog").getByText("确认删除")).toBeVisible({
				timeout: 10_000,
			});
			await page.getByRole("alertdialog").getByRole("button", { name: "删除" }).click();

			await expect(page.getByRole("cell", { name: "L3新增医生" })).toHaveCount(0, {
				timeout: 10_000,
			});
		});

		test("filters by hospital", async ({ page }) => {
			await page.goto("/doctors");

			await expect(page.getByRole("cell", { name: "L3测试医生" })).toBeVisible({
				timeout: 10_000,
			});

			const hospitalTrigger = page.getByRole("combobox").first();
			await hospitalTrigger.click();
			await page.getByRole("option", { name: "L3测试医院" }).click();

			await expect(page.getByRole("cell", { name: "L3测试医生" })).toBeVisible({
				timeout: 10_000,
			});

			const rowsCount = await page.getByRole("row").count();
			expect(rowsCount).toBeGreaterThan(1);

			await hospitalTrigger.click();
			await page.getByRole("option", { name: "全部医院" }).click();
		});
	});
