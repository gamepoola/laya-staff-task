const { capture } = require("./capture.cjs");
const { test, expect } = require("@playwright/test");
const { seed, guard } = require("../../tools/seed.cjs");
const {
  initializeApp: initializeAdminApp,
  getApps,
  getApp,
} = require("../../functions/sdk.cjs");
const {
  getFirestore,
  FieldValue,
  FieldPath,
} = require("../../functions/sdk.cjs");
const { getAuth: adminAuth } = require("../../functions/sdk.cjs");
const { getStorage: adminStorage } = require("../../functions/sdk.cjs");
let password;
test.beforeAll(async () => {
  process.env.GCLOUD_PROJECT = "demo-laya-v4";
  guard();
  if (!getApps().length) initializeAdminApp({ projectId: "demo-laya-v4" });
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
async function signIn(page, staff = "test-staff") {
  await page.goto("/login.html");
  await page.locator("[name=staffID]").fill(staff);
  await page.locator("[name=password]").fill(password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ →" }).click();
  await page.waitForURL(
    staff === "test-manager" ? "**/manager.html" : "**/staff.html",
  );
  await expect(page.locator("#content")).toBeVisible();
}
test("staff mobile: real JPEG submission, offline draft recovery, manager review and safe Thai UI", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 393, height: 851 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await signIn(page);
  await expect(page.locator("#tasks .task")).toHaveCount(4);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "ส่งงาน", exact: true }).first().click();
  await expect(page.locator("#taskTitle")).toHaveText("เตรียมเครื่องชงกาแฟ");
  await page.locator("#note").fill("แบบร่างสำหรับทดสอบ");
  const jpeg = await require("../../functions/node_modules/sharp")({
    create: { width: 80, height: 60, channels: 3, background: "#ccb78d" },
  })
    .jpeg()
    .toBuffer();
  await page
    .locator("#photo")
    .setInputFiles({ name: "photo.jpg", mimeType: "image/jpeg", buffer: jpeg });
  await expect(page.locator("#previews img")).toHaveCount(1);
  await page.reload();
  await expect(page.locator("#note")).toHaveValue("แบบร่างสำหรับทดสอบ");
  await expect(page.locator("#previews img")).toHaveCount(1);
  await page.context().setOffline(true);
  await expect(page.locator("#connection")).toContainText("ออฟไลน์");
  await page.locator("#submitWork").click();
  await expect(page.locator("#message")).toContainText("ออฟไลน์");
  expect((await getFirestore().collection("submissions").get()).size).toBe(0);
  await page.context().setOffline(false);
  let drop = true;
  await page.route("**/us-central1/submitWork", async (route) => {
    if (drop && route.request().method() === "POST") {
      drop = false;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.locator("#submitWork").click();
  await expect(page.locator("#message")).toContainText("ดำเนินการไม่สำเร็จ");
  expect((await getFirestore().collection("submissions").get()).size).toBe(1);
  await page.locator("#submitWork").click();
  await page.waitForURL("**/staff.html");
  await expect(page.locator("#history")).toContainText("รอตรวจ");
  await capture(page, { path: "docs/staff-mobile.png", fullPage: true });
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    mgr = await context.newPage();
  await signIn(mgr, "test-manager");
  await expect(mgr.locator("#submissions")).toContainText("แบบร่างสำหรับทดสอบ");
  await mgr.getByRole("button", { name: "ดูรูป", exact: true }).click();
  await expect(mgr.locator("#galleryImages img")).toHaveCount(1);
  await mgr.locator("#closeGallery").click();
  await mgr.getByRole("button", { name: "อนุมัติ", exact: true }).click();
  await mgr.locator(".confirm-dialog [data-ok]").click();
  await expect(mgr.locator("#submissions")).not.toContainText(
    "แบบร่างสำหรับทดสอบ",
  );
  await capture(mgr, { path: "docs/manager-desktop.png", fullPage: true });
  await page.locator("#refresh").click();
  await expect(page.locator("#quota")).toContainText("คะแนนสะสม 2");
  expect(errors).toEqual([]);
  await context.close();
});
test("staff cannot enter manager route; manager can save recurring task, staff shift, checklist and export", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/manager.html");
  await page.waitForURL("**/staff.html");
  await page.locator("#logout").click();
  await page.waitForURL("**/login.html");
  await signIn(page, "test-manager");
  await page.locator("[data-tab=manageTasks]").click();
  await page.locator("#taskForm [name=title]").fill("งานประจำสัปดาห์ใหม่");
  await page.locator("#taskForm [name=recurrence]").selectOption("weekly");
  await page.locator("#taskForm [name=weekdays]").fill("1,3,5");
  await page.locator("#taskForm button[type=submit]").click();
  await expect(page.locator("#taskList")).toContainText("งานประจำสัปดาห์ใหม่");
  await page.locator("[data-tab=review]").click();
  const download = page.waitForEvent("download");
  await page.locator("#export").click();
  expect((await download).suggestedFilename()).toBe("laya-performance.csv");
  await page.goto("/checklist.html");
  await expect(page.locator(".check-item")).toHaveCount(53);
  await page.locator("#checklistFilter [name=outlet]").selectOption("Banquet");
  await page.locator("#checklistFilter button").click();
  await expect(page.locator("#checkSummary")).toContainText("Banquet");
  await expect(page.locator(".check-item")).toHaveCount(53);
  await page.locator(".check-item select").first().selectOption("na");
  await page.locator("#saveChecklist").click();
  await expect(page.locator("#checkSummary")).toContainText("N/A 1");
  await page.reload();
  await page.locator("#checklistFilter [name=outlet]").selectOption("Banquet");
  await page.locator("#checklistFilter button").click();
  await expect(page.locator(".check-item select").first()).toHaveValue("na");
});
