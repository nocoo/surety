import { test, expect } from "./fixtures";

test.describe.serial("medical-visits CRUD", () => {
  test("page renders with heading and table", async ({ page }) => {
    await page.goto("/medical-visits");
    await expect(
      page.getByRole("heading", { level: 1, name: "就诊记录" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("table")).toBeVisible({ timeout: 10_000 });
  });

  test("seeded visit is visible in the table", async ({ page }) => {
    await page.goto("/medical-visits");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("L3种子就诊").first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("测试医院").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("create a new visit via VisitSheet", async ({ page }) => {
    await page.goto("/medical-visits");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "添加记录" }).click();
    await expect(
      page.getByRole("heading", { name: "添加就诊记录" }),
    ).toBeVisible({ timeout: 10_000 });

    // Member select
    await page.locator("#memberId").click();
    await page
      .getByRole("option", { name: "测试家庭成员" })
      .click();

    // visitType already defaults to 门诊; ensure it's set explicitly
    await page.locator("#visitType").click();
    await page.getByRole("option", { name: "门诊", exact: true }).click();

    // visitDate
    await page.locator("#visitDate").fill("2026-02-10");

    // visitReason
    await page.locator("#visitReason").fill("L3测试就诊原因");

    // Hospital select
    await page.locator("#hospitalId").click();
    await page.getByRole("option", { name: "测试医院" }).click();

    // Doctor (optional) — pick the seeded doctor
    await page.locator("#doctorId").click();
    await page.getByRole("option", { name: "测试医生" }).click();

    // Department
    await page.locator("#department").fill("内科");

    await page.getByRole("button", { name: "添加", exact: true }).click();

    await expect(
      page.getByRole("heading", { name: "添加就诊记录" }),
    ).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText("L3测试就诊原因").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("edit the created visit", async ({ page }) => {
    await page.goto("/medical-visits");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 10_000 });

    const row = page.getByRole("row", { name: /L3测试就诊原因/ });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole("button", { name: "编辑" }).click();

    await expect(
      page.getByRole("heading", { name: "编辑就诊记录" }),
    ).toBeVisible({ timeout: 10_000 });

    const reasonInput = page.locator("#visitReason");
    await reasonInput.fill("L3编辑后原因");

    await page.getByRole("button", { name: "保存修改" }).click();

    await expect(
      page.getByRole("heading", { name: "编辑就诊记录" }),
    ).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText("L3编辑后原因").first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("L3测试就诊原因")).toHaveCount(0, {
      timeout: 10_000,
    });
  });

  test("delete the edited visit", async ({ page }) => {
    page.on("dialog", (d) => {
      void d.accept();
    });

    await page.goto("/medical-visits");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 10_000 });

    const row = page.getByRole("row", { name: /L3编辑后原因/ });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole("button", { name: "删除" }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByRole("button", { name: "删除", exact: true }).click();

    await expect(page.getByText("L3编辑后原因")).toHaveCount(0, {
      timeout: 10_000,
    });
  });

  test("filter by member shows only that member's visits", async ({ page }) => {
    await page.goto("/medical-visits");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 10_000 });

    // Seeded visit should be present before filtering
    await expect(page.getByText("L3种子就诊").first()).toBeVisible({
      timeout: 10_000,
    });

    // Open the member filter (the only combobox in the header area)
    await page.getByRole("combobox").first().click();
    await page
      .getByRole("option", { name: "测试家庭成员" })
      .click();

    await expect(page.getByText("已筛选")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("L3种子就诊").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("门诊 and 急诊 use distinct badge variants", async ({
    page,
    request,
  }) => {
    // Create one 急诊 visit via the API so both types are present in the table
    const members = await request.get("/api/members");
    const memberList = (await members.json()) as Array<{
      id: number;
      name: string;
    }>;
    const member = memberList.find((m) => m.name === "测试家庭成员");
    expect(member).toBeDefined();

    const hospitals = await request.get("/api/hospitals");
    const hospitalList = (await hospitals.json()) as Array<{
      id: number;
      name: string;
    }>;
    const hospital = hospitalList.find((h) => h.name === "测试医院");
    expect(hospital).toBeDefined();
    if (!member || !hospital) return;

    const created = await request.post("/api/medical-visits", {
      data: {
        memberId: member.id,
        hospitalId: hospital.id,
        visitDate: "2026-03-01",
        visitType: "急诊",
        visitReason: "L3急诊测试",
        department: "急诊科",
      },
    });
    expect(created.status()).toBe(201);

    try {
      await page.goto("/medical-visits");
      await expect(page.getByRole("table")).toBeVisible({ timeout: 10_000 });

      const menZhenBadge = page
        .locator('[data-slot="badge"]', { hasText: "门诊" })
        .first();
      const jiZhenBadge = page
        .locator('[data-slot="badge"]', { hasText: "急诊" })
        .first();

      await expect(menZhenBadge).toBeVisible({ timeout: 10_000 });
      await expect(jiZhenBadge).toBeVisible({ timeout: 10_000 });

      const menZhenVariant = await menZhenBadge.getAttribute("data-variant");
      const jiZhenVariant = await jiZhenBadge.getAttribute("data-variant");

      expect(menZhenVariant).toBe("default");
      expect(jiZhenVariant).toBe("destructive");
      expect(menZhenVariant).not.toBe(jiZhenVariant);
    } finally {
      const body = (await created.json()) as { id: number };
      await request.delete(`/api/medical-visits/${body.id}`);
    }
  });
});
