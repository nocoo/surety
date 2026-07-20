import { expect, test } from "./fixtures";

test.describe
	.serial("hospitals page", () => {
		test("renders the hospitals page with header and table", async ({ page }) => {
			await page.goto("/hospitals");
			await expect(page.getByRole("heading", { level: 1, name: "医院管理" })).toBeVisible({
				timeout: 10_000,
			});
			await expect(page.getByRole("table")).toBeVisible({ timeout: 10_000 });
		});

		test("shows the seeded hospital", async ({ page }) => {
			await page.goto("/hospitals");
			await expect(page.getByRole("cell", { name: "L3测试医院" })).toBeVisible({
				timeout: 10_000,
			});
		});

		test("creates a new hospital", async ({ page }) => {
			await page.goto("/hospitals");
			await page.getByRole("button", { name: "添加医院" }).click();
			await expect(page.getByRole("heading", { name: "添加医院" })).toBeVisible({
				timeout: 10_000,
			});

			await page.getByLabel("医院名称").fill("L3新增医院");

			await page.getByRole("combobox", { name: "医院级别" }).click();
			await page.getByRole("option", { name: "三乙" }).click();

			const isPublicSwitch = page.getByRole("switch", { name: "公立医院" });
			if ((await isPublicSwitch.getAttribute("aria-checked")) !== "true") {
				await isPublicSwitch.click();
			}

			await page.getByRole("button", { name: "添加", exact: true }).click();

			await expect(page.getByRole("heading", { name: "添加医院" })).toBeHidden({ timeout: 10_000 });
			await expect(page.getByRole("cell", { name: "L3新增医院" })).toBeVisible({
				timeout: 10_000,
			});
		});

		test("edits an existing hospital", async ({ page }) => {
			await page.goto("/hospitals");
			const row = page.getByRole("row").filter({ hasText: "L3新增医院" });
			await row.getByRole("button", { name: "编辑" }).click();

			await expect(page.getByRole("heading", { name: "编辑医院" })).toBeVisible({
				timeout: 10_000,
			});

			const nameInput = page.getByLabel("医院名称");
			await nameInput.fill("L3编辑后医院");

			await page.getByRole("button", { name: "保存修改" }).click();

			await expect(page.getByRole("heading", { name: "编辑医院" })).toBeHidden({ timeout: 10_000 });
			await expect(page.getByRole("cell", { name: "L3编辑后医院" })).toBeVisible({
				timeout: 10_000,
			});
			await expect(page.getByRole("cell", { name: "L3新增医院" })).toHaveCount(0);
		});

		test("deletes a hospital", async ({ page }) => {
			page.on("dialog", (d) => d.accept());
			await page.goto("/hospitals");

			const row = page.getByRole("row").filter({ hasText: "L3编辑后医院" });
			await row.getByRole("button", { name: "删除医院" }).click();

			await expect(page.getByRole("alertdialog").getByText("确认删除")).toBeVisible({
				timeout: 10_000,
			});
			await page.getByRole("alertdialog").getByRole("button", { name: "删除" }).click();

			await expect(page.getByRole("cell", { name: "L3编辑后医院" })).toHaveCount(0, {
				timeout: 10_000,
			});
		});

		test("filters by hospital level", async ({ page }) => {
			await page.goto("/hospitals");

			await expect(page.getByRole("cell", { name: "L3测试医院" })).toBeVisible({
				timeout: 10_000,
			});

			const levelTrigger = page.getByRole("combobox").first();
			await levelTrigger.click();
			await page.getByRole("option", { name: "三甲" }).click();

			await expect(page.getByRole("cell", { name: "L3测试医院" })).toBeVisible({
				timeout: 10_000,
			});

			await levelTrigger.click();
			await page.getByRole("option", { name: "全部级别" }).click();
			await expect(page.getByRole("cell", { name: "L3测试医院" })).toBeVisible({
				timeout: 10_000,
			});
		});

		test("filters by hospital type (public/private)", async ({ page }) => {
			await page.goto("/hospitals");

			const typeTrigger = page.getByRole("combobox").nth(1);
			await typeTrigger.click();
			await page.getByRole("option", { name: "公立", exact: true }).click();

			await expect(page.getByRole("cell", { name: "L3测试医院" })).toBeVisible({
				timeout: 10_000,
			});

			await typeTrigger.click();
			await page.getByRole("option", { name: "私立", exact: true }).click();

			await expect(page.getByRole("cell", { name: "L3测试医院" })).toHaveCount(0, {
				timeout: 10_000,
			});

			await typeTrigger.click();
			await page.getByRole("option", { name: "全部", exact: true }).click();
		});
	});
