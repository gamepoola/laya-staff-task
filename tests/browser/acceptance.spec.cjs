const { capture } = require("./capture.cjs");
const { test, expect } = require("@playwright/test");
const { seed, guard } = require("../../tools/seed.cjs");
const { getFirestore } = require("../../functions/sdk.cjs");
let password;
test.beforeAll(async () => {
  process.env.GCLOUD_PROJECT = "demo-laya-v4";
  guard();
  await seed();
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
async function login(page, role) {
  await page.goto("/login.html");
  await page.locator("[name=staffID]").fill("test-" + role);
  await page.locator("[name=password]").fill(password);
  await page.locator("#loginForm button").click();
  await page.waitForURL("**/" + role + ".html");
  await expect(page.locator(".loading-panel")).toHaveCount(0);
  await expect(page.locator("#stats .stat")).toHaveCount(4);
}
async function shot(page, name) {
  await expect(page.locator(".loading-panel")).toHaveCount(0);
  await page.evaluate(() => scrollTo(0, 0));
  const geometry = await page.evaluate(() =>
    Object.fromEntries(
      [
        ".intro .eyebrow",
        ".topbar .mobile-menu",
        "#tasks a",
        "#submissions",
        ".check-jump",
      ].map((s) => {
        const r = document.querySelector(s)?.getBoundingClientRect();
        return [
          s,
          r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null,
        ];
      }),
    ),
  );
  require("node:fs").mkdirSync(
    `docs/acceptance/${process.env.CAPTURE_PHASE || "final"}`,
    { recursive: true },
  );
  require("node:fs").writeFileSync(
    `docs/acceptance/${process.env.CAPTURE_PHASE || "final"}/${name}-geometry.json`,
    JSON.stringify(geometry, null, 2),
  );
  await capture(page, {
    path: `docs/acceptance/${process.env.CAPTURE_PHASE || "final"}/${name}-full.png`,
    fullPage: true,
    animations: "disabled",
  });
  await capture(page, {
    path: `docs/acceptance/${process.env.CAPTURE_PHASE || "final"}/${name}-viewport.png`,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}
test("hospitality visual acceptance and two end-to-end review decisions", async ({
  browser,
}) => {
  const context = await browser.newContext({
      viewport: { width: 393, height: 851 },
      reducedMotion: "reduce",
    }),
    page = await context.newPage();
  await login(page, "staff");
  await shot(page, "03-staff-mobile");
  const jpeg = await require("../../functions/node_modules/sharp")({
    create: { width: 640, height: 480, channels: 3, background: "#c8a96b" },
  })
    .jpeg()
    .toBuffer();
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("link", { name: "ส่งงาน", exact: true })
      .first()
      .click();
    await expect(page.locator("#taskTitle")).not.toBeEmpty();
    await page.locator("#photo").setInputFiles({
      name: "synthetic-evidence.jpg",
      mimeType: "image/jpeg",
      buffer: jpeg,
    });
    await expect(page.locator("#previews img")).toHaveCount(1);
    await page
      .locator("#note")
      .fill("ข้อมูลทดสอบ: เตรียมพื้นที่และตรวจความพร้อมเรียบร้อย");
    if (i === 0) await shot(page, "04-submission-mobile");
    await page.locator("#submitWork").click();
    await page.waitForURL("**/staff.html");
    await expect(page.locator("#history")).toContainText("รอตรวจ");
  }
  const manager = await context.newPage();
  await manager.setViewportSize({ width: 1440, height: 900 });
  await login(manager, "manager");
  await shot(manager, "01-manager-desktop");
  await manager.setViewportSize({ width: 393, height: 851 });
  await shot(manager, "02-manager-mobile");
  await manager.setViewportSize({ width: 1440, height: 900 });
  await manager.locator("[data-tab=manageTasks]").click();
  await shot(manager, "06-task-management");
  await manager.locator("[data-tab=manageStaff]").click();
  await shot(manager, "07-employee-management");
  await manager.locator("[data-tab=review]").click();
  await manager.locator("[data-action=photo]").first().click();
  await expect(manager.locator("#galleryImages img")).toHaveCount(1);
  await manager.locator("#closeGallery").click();
  await manager.locator("[data-action=rejected]").first().click();
  await expect(manager.locator(".confirm-dialog")).toBeVisible();
  await manager
    .locator(".confirm-dialog textarea")
    .fill("กรุณาถ่ายรูปบริเวณเคาน์เตอร์ให้เห็นความสะอาดชัดเจน");
  await shot(manager, "08b-rejection-dialog");
  await manager.locator("[data-ok]").click();
  await expect(manager.locator(".confirm-dialog")).toHaveCount(0);
  await expect(manager.locator("#submissions")).toContainText(
    "กรุณาถ่ายรูปบริเวณ",
  );
  await manager.locator("[data-action=approved]").first().click();
  if (process.env.CAPTURE_PHASE !== "before") {
    await expect(manager.locator(".confirm-dialog")).toBeVisible();
    await shot(manager, "08a-approval-dialog");
    await manager.locator("[data-ok]").click();
  } else {
    await shot(manager, "08a-approval-direct-no-dialog");
  }
  await expect(manager.locator("#stats .stat").nth(2)).toContainText("1");
  await page.locator("#refresh").click();
  await expect(page.locator("#history")).toContainText("อนุมัติแล้ว");
  await expect(page.locator("#history")).toContainText("กรุณาถ่ายรูปบริเวณ");
  await manager.setViewportSize({ width: 393, height: 851 });
  await manager.goto("/checklist.html");
  await expect(manager.locator(".check-item")).toHaveCount(53);
  await shot(manager, "05-checklist-mobile");
  await manager.locator("#checkJump").selectOption("8");
  await expect(manager.locator(".check-category").nth(8)).toHaveAttribute(
    "open",
    "",
  );
  await expect(
    manager.locator(".check-category").nth(8).locator("summary"),
  ).toBeFocused();
  await context.close();
});
