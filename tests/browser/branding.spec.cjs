const { test, expect } = require("@playwright/test"),
  { seed, guard } = require("../../tools/seed.cjs"),
  { capture } = require("./capture.cjs");
let password;
test.beforeAll(async () => {
  process.env.GCLOUD_PROJECT = "demo-laya-v4";
  guard();
  ({ password } = await seed());
});
test("official branding on login, desktop manager and mobile staff", async ({
  page,
}) => {
  for (const [role, width, height] of [
    ["manager", 1440, 900],
    ["staff", 393, 851],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/login.html");
    await expect(page).toHaveTitle(/FB Staff APP/);
    await expect(page.locator(".logo")).toHaveText("FB Staff APP");
    await capture(page, {
      path: `docs/branding/login-${role}.png`,
      fullPage: true,
    });
    await page.locator("[name=staffID]").fill("test-" + role);
    await page.locator("[name=password]").fill(password);
    await page.locator("#loginForm button").click();
    await page.waitForURL("**/" + role + ".html");
    await expect(page.locator("#stats .stat")).toHaveCount(4);
    await expect(page.locator(".sidebar .logo")).toHaveText("FB Staff APP");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await capture(page, { path: `docs/branding/${role}.png`, fullPage: true });
    await page.locator("#logout").click();
    await page.waitForURL("**/login.html");
  }
});
