import { expect, test } from "./fixtures";

test.describe
	.serial("policies page CRUD", () => {
		test("renders the policies page with header and table", async ({ page }) => {
			await page.goto("/policies");
			await expect(page.getByRole("heading", { level: 1, name: "全部保单" })).toBeVisible({
				timeout: 10_000,
			});
		});

		test("shows the seeded policy", async ({ page }) => {
			await page.goto("/policies");
			await expect(page.getByText("测试产品").first()).toBeAttached({
				timeout: 10_000,
			});
		});

		test("creates a new policy", async ({ page }) => {
			await page.goto("/policies");
			await page.getByRole("button", { name: "新增保单" }).click();
			await expect(page.getByRole("heading", { name: "新增保单" })).toBeVisible({
				timeout: 10_000,
			});

			await page.locator("#productName").fill("L3新增保单产品");
			await page.locator("#insurerName").fill("L3测试保险");
			await page.locator("#policyNumber").fill("L3-TEST-002");

			// Select category
			const categoryTrigger = page.locator("button").filter({ hasText: "选择类型" });
			await categoryTrigger.click();
			await page.getByRole("option", { name: "医疗险" }).click();

			// Select applicant — wait for prerequisites to load
			const applicantTrigger = page.locator("button").filter({ hasText: "选择投保人" });
			await expect(applicantTrigger).toBeVisible({ timeout: 10_000 });
			await applicantTrigger.click();
			await page.getByRole("option", { name: "测试家庭成员" }).click();

			await page.locator("#effectiveDate").fill("2026-03-01");
			await page.locator("#sumAssured").fill("500000");
			await page.locator("#premium").fill("3000");

			await page.getByRole("button", { name: "创建保单" }).click();

			await expect(page.getByRole("heading", { name: "新增保单" })).toBeHidden({ timeout: 10_000 });
			await expect(page.getByText("L3新增保单产品").first()).toBeAttached({
				timeout: 10_000,
			});
		});

		test("navigates to policy detail page", async ({ page }) => {
			await page.goto("/policies");
			await expect(page.getByText("L3新增保单产品").first()).toBeAttached({
				timeout: 10_000,
			});

			// Click the detail button on the new policy row
			const row = page.getByRole("row").filter({ hasText: "L3新增保单产品" });
			await row.getByRole("button", { name: "查看详情" }).click();

			await expect(page.getByText("返回保单列表")).toBeVisible({ timeout: 10_000 });
			await expect(page.getByText("L3新增保单产品").first()).toBeVisible();
		});

		test("deletes a policy", async ({ page }) => {
			await page.goto("/policies");
			await expect(page.getByText("L3新增保单产品").first()).toBeAttached({
				timeout: 10_000,
			});

			const row = page.getByRole("row").filter({ hasText: "L3新增保单产品" });
			await row.getByRole("button", { name: "删除" }).click();

			await expect(page.getByRole("alertdialog").getByText("确认删除")).toBeVisible({
				timeout: 10_000,
			});
			await page.getByRole("alertdialog").getByRole("button", { name: "删除" }).click();

			await expect(page.getByText("L3新增保单产品")).toHaveCount(0, {
				timeout: 10_000,
			});
		});

		test("policy detail page renders for the seeded policy", async ({ page, request }) => {
			const list = await request.get("/api/policies");
			expect(list.status()).toBe(200);
			const policies = (await list.json()) as Array<{ id: number; policyNumber: string }>;
			const seed = policies.find((p) => p.policyNumber === "L3-SEED-001");
			expect(seed).toBeDefined();
			if (!seed) return;

			await page.goto(`/policies/${seed.id}`);
			await expect(page.getByText("返回保单列表")).toBeVisible({ timeout: 10_000 });
			await expect(page.getByText("测试产品").first()).toBeVisible();
		});
	});
