/**
 * L3 verification spec for the Task #7 policy-status UI wiring.
 *
 * Covers the five checkpoints from the task brief:
 *  1. Active policy detail surfaces the four action entries
 *     (退保 / 理赔结案 / 标记失效 / 标记拟退保).
 *  2. BasicInfoSection's "状态" row is readonly — no dropdown / Select.
 *  3. After POST /terminate succeeds, badge and action area switch to
 *     the terminated branch (修改终止信息 + 恢复 Active).
 *  4. Terminated state does NOT expose the planned-surrender entry.
 *  5. Expired display (DB Active, past expiryDate) still exposes the
 *     terminate / planned-surrender entries.
 *
 * Each test seeds a fresh policy via the API so it does not depend on
 * the shared global-setup seed and stays independent under
 * fullyParallel: false / workers: 1.
 */
import { test, expect } from "./fixtures";
import type { APIRequestContext } from "@playwright/test";

interface CreatedPolicy {
  id: number;
  policyNumber: string;
}

async function seedMember(request: APIRequestContext, suffix: string): Promise<number> {
  const res = await request.post("/api/members", {
    data: {
      name: `L3-Tx-Member-${suffix}`,
      relation: "self",
      gender: "M",
    },
  });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { id: number }).id;
}

async function seedPolicy(
  request: APIRequestContext,
  applicantId: number,
  policyNumber: string,
  overrides: Record<string, unknown> = {},
): Promise<CreatedPolicy> {
  const res = await request.post("/api/policies", {
    data: {
      applicantId,
      insuredType: "Member",
      insuredMemberId: applicantId,
      category: "Medical",
      insurerName: "L3 Tx Ins",
      productName: `L3 Tx Product ${policyNumber}`,
      policyNumber,
      effectiveDate: "2026-01-01",
      sumAssured: 100_000,
      premium: 1_000,
      paymentFrequency: "Yearly",
      ...overrides,
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as CreatedPolicy;
}

async function terminate(
  request: APIRequestContext,
  policyId: number,
): Promise<void> {
  const res = await request.post(`/api/policies/${policyId}/terminate`, {
    data: {
      status: "Surrendered",
      terminatedAt: "2026-03-01",
      terminationReason: "L3 verify",
    },
  });
  expect(res.status()).toBe(200);
}

test.describe("policy-detail status transitions UI", () => {
  test("Active policy: four action entries are visible", async ({ page, request }) => {
    const memberId = await seedMember(request, "active");
    const policy = await seedPolicy(request, memberId, "L3-TX-A1");

    await page.goto(`/policies/${policy.id}`);
    await expect(page.getByText("返回保单列表")).toBeVisible({
      timeout: 10_000,
    });

    await expect(
      page.getByRole("button", { name: "退保", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "理赔结案" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "标记失效" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "标记拟退保" }),
    ).toBeVisible();
  });

  test("status row is readonly — no Select / dropdown", async ({ page, request }) => {
    const memberId = await seedMember(request, "readonly");
    const policy = await seedPolicy(request, memberId, "L3-TX-A2");

    await page.goto(`/policies/${policy.id}`);
    await expect(page.getByText("返回保单列表")).toBeVisible({
      timeout: 10_000,
    });

    // Status badge label is rendered next to a label cell of "状态".
    const statusRow = page
      .locator("div")
      .filter({ hasText: /^状态/ })
      .first();
    await expect(statusRow).toBeVisible();
    // There is no <select> or radix select trigger button near the
    // 状态 row — the old EditableInfoRow dropdown is removed.
    await expect(statusRow.locator("select")).toHaveCount(0);
    await expect(
      statusRow.getByRole("combobox", { name: "状态" }),
    ).toHaveCount(0);
  });

  test("after terminate: badge + action area switch to terminal branch", async ({
    page,
    request,
  }) => {
    const memberId = await seedMember(request, "terminate");
    const policy = await seedPolicy(request, memberId, "L3-TX-A3");
    await terminate(request, policy.id);

    await page.goto(`/policies/${policy.id}`);
    await expect(page.getByText("返回保单列表")).toBeVisible({
      timeout: 10_000,
    });

    // Badge flipped to 已退保 (Surrendered label).
    await expect(page.getByText("已退保").first()).toBeVisible();
    // Active-only entries are gone.
    await expect(
      page.getByRole("button", { name: "退保", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "标记拟退保" }),
    ).toHaveCount(0);
    // Terminal branch entries are present.
    await expect(
      page.getByRole("button", { name: "修改终止信息" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "恢复 Active" }),
    ).toBeVisible();
  });

  test("terminal state does NOT expose planned-surrender entry", async ({
    page,
    request,
  }) => {
    const memberId = await seedMember(request, "noplan");
    const policy = await seedPolicy(request, memberId, "L3-TX-A4");
    await terminate(request, policy.id);

    await page.goto(`/policies/${policy.id}`);
    await expect(page.getByText("返回保单列表")).toBeVisible({
      timeout: 10_000,
    });

    await expect(
      page.getByRole("button", { name: "标记拟退保" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "编辑拟退保" }),
    ).toHaveCount(0);
  });

  test("Expired display (DB Active, past expiryDate) still exposes terminate + planned-surrender", async ({
    page,
    request,
  }) => {
    // Past expiryDate forces deriveDisplayStatus → "Expired" but the DB
    // row stays Active, so the action area must still render the four
    // Active-branch entries.
    const memberId = await seedMember(request, "expired");
    const policy = await seedPolicy(request, memberId, "L3-TX-A5", {
      effectiveDate: "2024-01-01",
      expiryDate: "2025-01-01",
    });

    await page.goto(`/policies/${policy.id}`);
    await expect(page.getByText("返回保单列表")).toBeVisible({
      timeout: 10_000,
    });

    // Display badge is "已过期".
    await expect(page.getByText("已过期").first()).toBeVisible();
    // All four Active-branch entries remain.
    await expect(
      page.getByRole("button", { name: "退保", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "理赔结案" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "标记失效" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "标记拟退保" }),
    ).toBeVisible();
  });

  test("terminated row edit form: status select reduces to Paid only and back-fill succeeds", async ({
    page,
    request,
  }) => {
    const memberId = await seedMember(request, "editpaid");
    const policy = await seedPolicy(request, memberId, "L3-TX-A6");

    // Seed a Pending payment whose dueDate is on/before the terminated
    // date so it stays in the live list after termination — otherwise it
    // would land in the obsoleted collapsible and the Pencil button
    // wouldn't render. Using the same day satisfies
    // `isObsoletedByTermination(p, terminatedAt) === false`.
    const paymentRes = await request.post(
      `/api/policies/${policy.id}/payments`,
      {
        data: {
          periodNumber: 1,
          dueDate: "2026-06-15",
          amount: 1000,
          status: "Pending",
        },
      },
    );
    expect(paymentRes.status()).toBe(201);

    const terminateRes = await request.post(
      `/api/policies/${policy.id}/terminate`,
      {
        data: {
          status: "Surrendered",
          terminatedAt: "2026-06-15",
          terminationReason: "L3 paid-only edit",
        },
      },
    );
    expect(terminateRes.status()).toBe(200);

    await page.goto(`/policies/${policy.id}`);
    await expect(page.getByText("返回保单列表")).toBeVisible({
      timeout: 10_000,
    });

    // PaymentsSection is identified by its 缴费记录 heading. The
    // MetaColumn 修改终止信息 button uses a Pencil icon too, but it is a
    // size-sm outline button with the visible 修改终止信息 label.
    // Row-edit Pencils are size-6 ghost icon buttons — filter on the
    // size-6 class so we never pick the MetaColumn button.
    await expect(page.getByText("第1期").first()).toBeVisible();
    await page
      .locator("button.size-6:has(svg.lucide-pencil)")
      .first()
      .click({ force: true });

    // The edit form mounts inline after the Pencil click. Its Select
    // trigger uses role="combobox" with currently-displayed value
    // "已缴" (because terminated mode forces status into Paid). Filter
    // by that displayed text — MetaColumn's category/asset comboboxes
    // never show "已缴" so this disambiguates without coupling to row
    // order or nth().
    const statusTrigger = page
      .getByRole("combobox")
      .filter({ hasText: "已缴" });
    await expect(statusTrigger).toBeVisible();
    await statusTrigger.click();
    await expect(
      page.getByRole("option", { name: "已缴" }),
    ).toBeVisible();
    await expect(page.getByRole("option", { name: "待缴" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    // Submit — the PUT body excludes structural fields (verified by the
    // task #8 builder unit test and the task #4 API contract). Save
    // success means the API accepted the back-fill payload.
    await page.getByRole("button", { name: /^保存$/ }).click();

    // After save, the row badge flips to 已缴.
    await expect(page.getByText("已缴").first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
