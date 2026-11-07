const { capture } = require("./capture.cjs");
const { test, expect } = require("@playwright/test");
const { seed, guard } = require("../../tools/seed.cjs");
const { getFirestore } = require("../../functions/sdk.cjs");
let password;
test.beforeAll(async () => {
  process.env.GCLOUD_PROJECT = "demo-laya-v4";
  guard();
  ({ password } = await seed());
  for (const name of [
    "tasks",
    "submissions",
    "dailyQuotas",
    "pointTransactions",
    "manager_checklists",
  ])
    await getFirestore().recursiveDelete(getFirestore().collection(name));
  ({ password } = await seed());
});
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});
async function login(page, role) {
  await page.goto("/login.html");
  await page.locator("[name=staffID]").fill("test-" + role);
  await page.locator("[name=password]").fill(password);
  await page.locator("#loginForm button").click();
  await page.waitForURL(
    role === "manager" ? "**/manager.html" : "**/staff.html",
  );
  await expect(page.locator("#stats .stat")).toHaveCount(4);
}
async function noOverflow(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}
test("premium manager: chart, search, responsive screens and checklist categories", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await login(page, "manager");
  await expect(page.locator(".report-visual")).toBeVisible();
  await noOverflow(page);
  await capture(page, {
    path: `docs/regression/ui-manager-${info.project.name}.png`,
    fullPage: true,
  });
  await page.locator("[data-tab=manageTasks]").click();
  await page.locator("#taskList").waitFor();
  await page
    .locator("#taskList")
    .locator("..")
    .getByRole("searchbox")
    .fill("เตรียม");
  await expect(page.locator("#taskList article:visible")).toHaveCount(1);
  await capture(page, {
    path: `docs/regression/ui-tasks-${info.project.name}.png`,
    fullPage: true,
  });
  await page.locator("[data-tab=manageStaff]").click();
  await capture(page, {
    path: `docs/regression/ui-employees-${info.project.name}.png`,
    fullPage: true,
  });
  for (const width of [360, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator("[data-tab=review]").click();
    await noOverflow(page);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/checklist.html");
  await expect(page.locator(".check-category")).toHaveCount(9);
  await expect(page.locator(".check-item")).toHaveCount(53);
  await expect(page.locator(".check-category[open]")).toHaveCount(1);
  await noOverflow(page);
  await capture(page, {
    path: `docs/regression/ui-checklist-mobile-${info.project.name}.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1080 });
  await capture(page, {
    path: `docs/regression/ui-checklist-${info.project.name}.png`,
    fullPage: true,
  });
});
test("premium staff and upload at narrow mobile width", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "staff");
  await expect(page.locator(".staff-progress")).toBeVisible();
  await noOverflow(page);
  await capture(page, {
    path: `docs/regression/ui-staff-mobile-${info.project.name}.png`,
    fullPage: true,
  });
  const task = page.getByRole("link", { name: "ส่งงาน", exact: true });
  if (await task.count()) {
    await task.first().click();
    await expect(page.locator(".upload-steps")).toBeVisible();
    await expect(page.locator("#taskTitle")).not.toBeEmpty();
    await expect(page.locator(".loading-panel")).toHaveCount(0);
    await noOverflow(page);
    await capture(page, {
      path: `docs/regression/ui-upload-mobile-${info.project.name}.png`,
      fullPage: true,
    });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page.evaluate(
      () => getComputedStyle(document.querySelector(".card")).animationName,
    ),
  ).toBe("none");
});
