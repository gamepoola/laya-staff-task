const { capture } = require("./capture.cjs");
const { test, expect } = require("@playwright/test"),
  { seed, guard } = require("../../tools/seed.cjs"),
  { getFirestore, getStorage, FieldValue } = require("../../functions/sdk.cjs"),
  R = require("../../functions/retention.cjs"),
  D = require("../../functions/domain.cjs");
let password;
test.beforeAll(async () => {
  process.env.GCLOUD_PROJECT = "demo-laya-v4";
  guard();
  ({ password } = await seed());
  const db = getFirestore();
  await db.recursiveDelete(db.collection("submissions"));
  await db.doc("maintenance/evidenceCleanup").delete();
  const sid = D.day() + "__test-staff__task1",
    path = `evidence/test-staff/${sid}/retention-ui-test/0.jpg`,
    bucket = getStorage().bucket("demo-laya-v4.firebasestorage.app");
  const jpeg = await require("../../functions/node_modules/sharp")({
    create: { width: 20, height: 20, channels: 3, background: "#c8a96b" },
  })
    .jpeg()
    .toBuffer();
  await bucket
    .file(path)
    .save(jpeg, { metadata: { contentType: "image/jpeg" } });
  await db.doc("submissions/" + sid).set({
    staffUid: "test-staff",
    staffName: "พนักงาน ทดสอบ",
    taskId: "task1",
    taskTitle: "เตรียมเครื่องชงกาแฟ",
    department: "FB",
    outlet: "The Taste",
    date: D.day(),
    status: "waiting",
    photoPaths: [path],
    photoPath: path,
    photosCount: 1,
    createdAt: FieldValue.serverTimestamp(),
  });
  await R.runCleanup({
    db,
    bucket,
    dryRun: false,
    now: Date.now() + R.AGE + 1000,
  });
});
test("expired evidence appears without broken images for staff and manager", async ({
  browser,
}, info) => {
  for (const role of ["staff", "manager"]) {
    const context = await browser.newContext({
        viewport: { width: role === "staff" ? 393 : 1440, height: 851 },
      }),
      page = await context.newPage();
    await page.goto("/login.html");
    await page.locator("[name=staffID]").fill("test-" + role);
    await page.locator("[name=password]").fill(password);
    await page.locator("#loginForm button").click();
    await page.waitForURL("**/" + role + ".html");
    const root = page.locator(role === "staff" ? "#history" : "#submissions");
    await expect(root).toContainText("เตรียมเครื่องชงกาแฟ");
    if (role === "manager")
      await expect(root).toContainText(
        "รูปหลักฐานหมดอายุและถูกลบอัตโนมัติหลัง 7 วัน",
      );
    await root
      .getByRole("button", { name: "ดูรูป", exact: true })
      .first()
      .click();
    await expect(page.locator("#galleryImages")).toContainText(
      "รูปหลักฐานหมดอายุและถูกลบอัตโนมัติหลัง 7 วัน",
    );
    await expect(page.locator("#galleryImages img")).toHaveCount(0);
    await capture(page, {
      path: `docs/release/expired-${role}-${info.project.name}.png`,
    });
    await context.close();
  }
});
