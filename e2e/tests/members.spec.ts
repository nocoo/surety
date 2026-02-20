import { test, expect } from "../fixtures/base";
import { MembersPage } from "../pages/members.page";

test.describe("Members", () => {
  let members: MembersPage;

  test.beforeEach(async ({ page }) => {
    members = new MembersPage(page);
    await members.goto();
  });

  test("shows page heading and member count", async () => {
    await expect(members.heading).toBeVisible();
    await expect(members.memberCount).toBeVisible();
    await expect(members.memberCount).toContainText("共 7 位成员");
  });

  test("shows all seed members in table", async () => {
    const seedNames = [
      "张伟",
      "李娜",
      "张小明",
      "李建国",
      "王秀英",
      "张国强",
      "刘桂芳",
    ];
    for (const name of seedNames) {
      await expect(members.row(name)).toBeVisible();
    }
  });

  test("shows relation badges correctly", async () => {
    await expect(members.row("张伟")).toContainText("本人");
    await expect(members.row("李娜")).toContainText("配偶");
    await expect(members.row("张小明")).toContainText("子女");
    await expect(members.row("李建国")).toContainText("父母");
  });

  test("Self member cannot be deleted", async () => {
    const deleteBtn = members.deleteButton("张伟");
    await expect(deleteBtn).toBeDisabled();
  });

  test("add a new member", async () => {
    await members.addButton.click();
    await expect(members.sheet).toBeVisible();
    await expect(members.sheetTitle).toContainText("添加成员");

    await members.fillMemberForm({
      name: "测试新成员",
      relation: "配偶",
      gender: "女",
      birthDate: "1990-06-15",
      phone: "13900139000",
    });

    await members.submitButton.click();

    // Sheet should close and new member should appear
    await expect(members.sheet).not.toBeVisible();
    await expect(members.row("测试新成员")).toBeVisible();
  });

  test("edit an existing member", async () => {
    await members.editButton("李建国").click();
    await expect(members.sheet).toBeVisible();
    await expect(members.sheetTitle).toContainText("编辑成员");

    // Change phone number
    await members.phoneInput.fill("13999999999");
    await members.submitButton.click();

    await expect(members.sheet).not.toBeVisible();
    // Row should still exist
    await expect(members.row("李建国")).toBeVisible();
  });

  test("delete a member", async () => {
    // First add a member we can safely delete
    await members.addButton.click();
    await members.fillMemberForm({
      name: "待删除成员",
      relation: "子女",
      gender: "男",
      birthDate: "2020-01-01",
    });
    await members.submitButton.click();
    await expect(members.sheet).not.toBeVisible();
    await expect(members.row("待删除成员")).toBeVisible();

    // Now delete it
    await members.deleteButton("待删除成员").click();
    await expect(members.deleteDialog).toBeVisible();
    await expect(members.deleteDialog).toContainText("待删除成员");

    await members.deleteConfirmButton.click();
    await expect(members.deleteDialog).not.toBeVisible();
    await expect(members.row("待删除成员")).not.toBeVisible();
  });

  test("cancel adding a member closes sheet without changes", async () => {
    // Capture current count before cancelling
    const countText = await members.memberCount.textContent();

    await members.addButton.click();
    await expect(members.sheet).toBeVisible();

    await members.nameInput.fill("不应该添加的成员");
    await members.cancelButton.click();

    await expect(members.sheet).not.toBeVisible();
    // Count should remain unchanged
    await expect(members.memberCount).toContainText(countText!);
  });
});
