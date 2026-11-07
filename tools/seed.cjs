const {
  initializeApp: initializeAdminApp,
  getApps,
  getApp,
} = require("../functions/sdk.cjs");
const { getFirestore, FieldValue, FieldPath } = require("../functions/sdk.cjs");
const { getAuth: adminAuth } = require("../functions/sdk.cjs");
const { getStorage: adminStorage } = require("../functions/sdk.cjs");
const crypto = require("node:crypto");
function guard() {
  if (
    !process.env.FIRESTORE_EMULATOR_HOST ||
    !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
    !process.env.GCLOUD_PROJECT?.startsWith("demo-")
  )
    throw Error(
      "Seed only allowed with demo project and Auth/Firestore emulators",
    );
}
async function seed() {
  guard();
  if (!getApps().length)
    initializeAdminApp({
      projectId: process.env.GCLOUD_PROJECT,
      storageBucket: "demo-laya-v4.firebasestorage.app",
    });
  const db = getFirestore();
  const password =
    process.env.LAYA_TEST_PASSWORD ||
    crypto.randomBytes(18).toString("base64url");
  const users = [
    ["test-manager", "manager", "ผู้จัดการ ทดสอบ"],
    ["test-staff", "staff", "พนักงาน ทดสอบ"],
    ["test-other", "staff", "ทีมอีกจุดบริการ"],
  ];
  for (const [uid, role, name] of users) {
    const email = uid + "@laya.local";
    try {
      await adminAuth().createUser({ uid, email, password });
    } catch (e) {
      if (e.code !== "auth/uid-already-exists") throw e;
      await adminAuth().updateUser(uid, { password });
    }
    await db
      .doc("staff/" + uid)
      .set({
        staffID: uid,
        role,
        name,
        department: uid === "test-other" ? "HK" : "FB",
        outlet: uid === "test-other" ? "Banquet" : "The Taste",
        shift: "Morning",
        points: 0,
        active: true,
      });
  }
  const D = require("../functions/domain.cjs");
  for (let i = 1; i <= 4; i++)
    await db
      .doc("tasks/task" + i)
      .set({
        title: [
          "เตรียมเครื่องชงกาแฟ",
          "จัดโต๊ะอาหาร",
          "ตรวจจุดบริการ",
          "ตรวจพื้นที่ส่วนกลาง",
        ][i - 1],
        description: "ตรวจความพร้อมและถ่ายรูปหลักฐาน",
        priority: i === 1 ? "High" : "Normal",
        assignedTo: "test-staff",
        department: "FB",
        outlet: "The Taste",
        shift: "Morning",
        forDate: D.day(),
        recurrence: "daily",
        active: true,
        requiredPhoto: true,
        dueTime: "10:00",
      });
  return { password };
}
module.exports = { seed, guard };
if (require.main === module)
  seed()
    .then((r) =>
      console.log(
        "LOCAL EMULATOR ONLY — test-manager / test-staff password: " +
          r.password,
      ),
    )
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    });
