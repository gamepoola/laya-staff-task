const crypto = require("node:crypto"),
  fs = require("node:fs");
const {
  initializeApp,
  getFirestore,
  getAuth,
} = require("../functions/sdk.cjs");
async function provision(count = 5) {
  if (
    process.env.GCLOUD_PROJECT !== "demo-laya-pilot" ||
    !process.env.FIRESTORE_EMULATOR_HOST ||
    !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
    !Number.isInteger(count) ||
    count < 5 ||
    count > 10
  )
    throw Error(
      "Synthetic pilot only: demo-laya-pilot, both emulators, 5–10 staff",
    );
  const app = initializeApp(
      { projectId: "demo-laya-pilot" },
      "pilot-" + crypto.randomUUID(),
    ),
    db = getFirestore(app),
    auth = getAuth(app),
    credentials = [];
  for (let i = 0; i <= count; i++) {
    const uid = i ? "pilot" + String(i).padStart(2, "0") : "pilot-manager",
      password = crypto.randomBytes(24).toString("base64url"),
      email = uid + "@laya.local";
    try {
      await auth.createUser({ uid, email, password });
    } catch (e) {
      if (e.code !== "auth/uid-already-exists") throw e;
      await auth.updateUser(uid, { password });
    }
    await db
      .doc("staff/" + uid)
      .set({
        staffID: uid,
        name: i ? "พนักงานสังเคราะห์ " + i : "ผู้จัดการสังเคราะห์",
        role: i ? "staff" : "manager",
        department: "FB",
        outlet: "The Taste",
        shift: "Morning",
        active: true,
        points: 0,
      });
    credentials.push({ staffID: uid, password });
  }
  for (const [id, title] of [
    ["pilot-opening", "ตรวจเตรียมจุดบริการ"],
    ["pilot-handover", "ตรวจส่งมอบกะ"],
  ])
    await db
      .doc("tasks/" + id)
      .set({
        title,
        description: "งานสังเคราะห์สำหรับฝึก ใช้รูปไม่มีบุคคล",
        assignedTo: "outlet",
        outlet: "The Taste",
        department: "FB",
        shift: "Morning",
        recurrence: "daily",
        priority: "Normal",
        requiredPhoto: true,
        active: true,
      });
  return credentials;
}
module.exports = { provision };
if (require.main === module)
  (async () => {
    const output = process.argv[3];
    if (!output || fs.existsSync(output))
      throw Error("Provide NEW private credential file outside release folder");
    const data = await provision(Number(process.argv[2] || 5));
    fs.writeFileSync(output, JSON.stringify(data, null, 2), { mode: 0o600 });
    console.log(
      "Synthetic pilot accounts provisioned; credentials written to specified private file.",
    );
  })().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
