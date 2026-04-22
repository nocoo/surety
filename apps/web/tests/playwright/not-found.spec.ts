import { test, expect } from "./fixtures";

test("unknown route returns SPA fallback (200, no hard 404 from worker)", async ({
  page,
}) => {
  const response = await page.goto("/non-existent-route-xyz");
  expect(response?.status()).toBe(200);
  await expect(page.locator("#root")).toBeAttached();
});
