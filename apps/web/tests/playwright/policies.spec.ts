import { test, expect } from "./fixtures";

test("policies page lists the seeded policy", async ({ page }) => {
  await page.goto("/policies");
  await expect(
    page.getByRole("heading", { level: 1, name: "全部保单" }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("测试产品").first()).toBeAttached();
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
