const { test, expect } = require("@playwright/test");
const { seed, guard } = require("../../tools/seed.cjs");
const { capture } = require("./capture.cjs");
let password;
test.beforeAll(async () => {
  process.env.GCLOUD_PROJECT = "demo-laya-v4";
  guard();
  ({ password } = await seed());
});
test("login shows a setup message if the app script fails to load", async ({
  page,
}) => {
  await page.route("**/js/bundle.js", (route) =>
    route.fulfill({ status: 404 }),
  );
  await page.goto("/login.html");
  await expect(page.locator("#message")).toContainText("กำลังโหลดระบบ");
  await expect(page.locator("#registrationToggle")).toBeDisabled();
  await expect(page.locator("#loginForm button")).toBeDisabled();
  await expect(page.locator("#loginForm")).toHaveAttribute("method", "post");
});
test("staff registration, manager activation, reset and suspended access", async ({
  page,
}) => {
  const staffID = "signup-" + Date.now(),
    secret = "First-password-123!",
    updated = "Changed-password-456!";
  await page.setViewportSize({ width: 393, height: 851 });
  await page.goto("/login.html");
  await page.locator("#registrationToggle").click();
  await page.locator("[name=registrationName]").fill("พนักงานสมัครใหม่");
  await page.locator("[name=staffID]").fill(staffID);
  await page.locator("[name=password]").fill(secret);
  await page.locator("[name=confirmPassword]").fill(secret);
  await capture(page, {
    path: "docs/accounts/register-mobile.png",
    fullPage: true,
  });
  await page.locator("#loginForm button").click();
  await expect(page.locator("#message")).toContainText("สมัครแล้ว");
  async function login(id, pw) {
    await page.locator("[name=staffID]").fill(id);
    await page.locator("[name=password]").fill(pw);
    await page.locator("#loginForm button").click();
  }
  await login(staffID, secret);
  await expect(page.locator("#message")).toContainText("ไม่มีสิทธิ์");
  await login("test-manager", password);
  await page.waitForURL("**/manager.html");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator("[data-tab=manageStaff]").click();
  const row = page.locator("#staffList article").filter({ hasText: staffID });
  await expect(row).toContainText("รอเปิดสิทธิ์");
  await row.getByRole("button").click();
  await page.locator("#staffForm [name=active]").check();
  await page.locator("#staffForm button[type=submit]").click();
  await expect(row).toContainText("เปิดสิทธิ์แล้ว");
  await row.getByRole("button").click();
  await page.locator("#staffForm [name=password]").fill(updated);
  await page.locator("#resetStaffPassword").click();
  await page.locator("dialog [data-ok]").click();
  await expect(
    page.getByRole("status").filter({ hasText: "ตั้งรหัสผ่านใหม่แล้ว" }),
  ).toBeVisible();
  await capture(page, {
    path: "docs/accounts/manager-accounts.png",
    fullPage: true,
  });
  await page.locator("#logout").click();
  await page.waitForURL("**/login.html");
  await login(staffID, secret);
  await expect(page.locator("#message")).not.toBeEmpty();
  await login(staffID, updated);
  await page.waitForURL("**/staff.html");
  await page.locator("#logout").click();
  await page.waitForURL("**/login.html");
  await login("test-manager", password);
  await page.waitForURL("**/manager.html");
  await page.locator("[data-tab=manageStaff]").click();
  await row.getByRole("button").click();
  await page.locator("#staffForm [name=active]").uncheck();
  await page.locator("#staffForm button[type=submit]").click();
  await expect(row).toContainText("ปิดสิทธิ์");
  await expect(
    page.getByRole("status").filter({ hasText: "บันทึกพนักงานแล้ว" }).last(),
  ).toBeVisible();
  await page.locator("#logout").click();
  await page.waitForURL("**/login.html");
  await login(staffID, updated);
  await expect(page.locator("#message")).toContainText("ไม่มีสิทธิ์");
});
