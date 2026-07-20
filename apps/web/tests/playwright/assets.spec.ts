import { expect, test } from "./fixtures";

test.describe
	.serial("assets page CRUD", () => {
		test("assets page renders heading and table", async ({ page }) => {
			await page.goto("/assets");
			await expect(page.getByRole("heading", { level: 1, name: "资产管理" })).toBeVisible({
				timeout: 10_000,
			});
			await expect(page.getByRole("table")).toBeVisible({ timeout: 10_000 });
			await expect(page.getByText("L3种子公寓")).toBeVisible({ timeout: 10_000 });
		});

		test("create RealEstate asset", async ({ page }) => {
			await page.goto("/assets");
			await page.getByRole("button", { name: "添加资产" }).click();
			await expect(page.getByRole("heading", { name: "添加资产" })).toBeVisible({
				timeout: 10_000,
			});

			await page.getByRole("combobox").first().click();
			await page.getByRole("option", { name: "不动产" }).click();

			await page.getByLabel("资产名称").fill("L3测试公寓");
			await page.getByLabel("产权证号").fill("沪房TEST001");

			await page.getByRole("combobox").nth(1).click();
			await page.getByRole("option", { name: "测试家庭成员" }).click();

			await page.getByRole("button", { name: "添加资产", exact: true }).last().click();

			await expect(page.getByText("L3测试公寓")).toBeVisible({ timeout: 10_000 });
		});

		test("create Vehicle asset", async ({ page }) => {
			await page.goto("/assets");
			await page.getByRole("button", { name: "添加资产" }).click();
			await expect(page.getByRole("heading", { name: "添加资产" })).toBeVisible({
				timeout: 10_000,
			});

			await page.getByRole("combobox").first().click();
			await page.getByRole("option", { name: "车辆" }).click();

			await page.getByLabel("资产名称").fill("L3测试车");
			await page.getByLabel("车牌号").fill("沪A12345");

			await page.getByRole("button", { name: "添加资产", exact: true }).last().click();

			await expect(page.getByText("L3测试车")).toBeVisible({ timeout: 10_000 });
		});

		test("edit asset name", async ({ page }) => {
			await page.goto("/assets");
			const targetRow = page.getByRole("row", { name: /L3测试公寓/ });
			await expect(targetRow).toBeVisible({ timeout: 10_000 });
			await targetRow.getByRole("button", { name: "编辑" }).click();

			await expect(page.getByRole("heading", { name: "编辑资产" })).toBeVisible({
				timeout: 10_000,
			});

			const nameInput = page.getByLabel("资产名称");
			await nameInput.fill("L3编辑后公寓");

			await page.getByRole("button", { name: "保存修改" }).click();

			await expect(page.getByText("L3编辑后公寓")).toBeVisible({ timeout: 10_000 });
			await expect(page.getByText("L3测试公寓")).toHaveCount(0, { timeout: 10_000 });
		});

		test("delete asset", async ({ page }) => {
			page.on("dialog", (d) => {
				void d.accept();
			});
			await page.goto("/assets");

			const targetRow = page.getByRole("row", { name: /L3测试车/ });
			await expect(targetRow).toBeVisible({ timeout: 10_000 });
			await targetRow.getByRole("button", { name: "删除" }).click();

			await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 10_000 });
			await page.getByRole("button", { name: "删除", exact: true }).click();

			await expect(page.getByText("L3测试车")).toHaveCount(0, { timeout: 10_000 });
		});

		test("RealEstate and Vehicle badges have distinct styles", async ({ page, request }) => {
			// Create a Vehicle through the API so both badge types are present on the page.
			const vehicle = await request.post("/api/assets", {
				data: {
					type: "Vehicle",
					name: "L3徽章车",
					identifier: "沪B99999",
					ownerId: null,
				},
			});
			expect(vehicle.status()).toBe(201);

			await page.goto("/assets");

			const realEstateBadge = page.getByRole("row", { name: /L3编辑后公寓/ }).getByText("不动产");
			const vehicleBadge = page.getByRole("row", { name: /L3徽章车/ }).getByText("车辆");

			await expect(realEstateBadge).toBeVisible({ timeout: 10_000 });
			await expect(vehicleBadge).toBeVisible({ timeout: 10_000 });

			const realEstateClass = await realEstateBadge.getAttribute("class");
			const vehicleClass = await vehicleBadge.getAttribute("class");
			expect(realEstateClass).toBeTruthy();
			expect(vehicleClass).toBeTruthy();
			expect(realEstateClass).not.toBe(vehicleClass);
		});
	});
