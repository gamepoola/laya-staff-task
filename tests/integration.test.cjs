const { test, before, after } = require("node:test"),
  assert = require("node:assert/strict");
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
} = require("firebase/firestore");
const {
  ref,
  uploadBytes,
  getBytes,
  deleteObject,
} = require("firebase/storage");
const { initializeApp, deleteApp } = require("firebase/app");
const {
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
} = require("firebase/auth");
const {
  getFunctions,
  connectFunctionsEmulator,
  httpsCallable,
} = require("firebase/functions");
const {
  initializeApp: initializeAdminApp,
  getApps,
  getApp,
} = require("../functions/sdk.cjs");
const { getFirestore, FieldValue, FieldPath } = require("../functions/sdk.cjs");
const { getAuth: adminAuth } = require("../functions/sdk.cjs");
const { getStorage: adminStorage } = require("../functions/sdk.cjs"),
  sharp = require("../functions/node_modules/sharp");
const fs = require("node:fs");
const { seed } = require("../tools/seed.cjs");
const D = require("../functions/domain.cjs");
const R = require("../functions/retention.cjs");
let env,
  password,
  jpeg,
  clients = [];
async function client(uid) {
  const app = initializeApp(
    {
      projectId: "demo-laya-v4",
      apiKey: "demo-key",
      storageBucket: "demo-laya-v4.firebasestorage.app",
    },
    (uid || "anonymous") + Math.random(),
  );
  clients.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  if (uid)
    await signInWithEmailAndPassword(auth, uid + "@laya.local", password);
  const fn = getFunctions(app, "us-central1");
  connectFunctionsEmulator(fn, "127.0.0.1", 5001);
  return (name, data) => httpsCallable(fn, name)(data).then((r) => r.data);
}
async function photo(uid, requestId, bytes = jpeg) {
  const path = `drafts/${uid}/${requestId}/0.jpg`;
  await adminStorage()
    .bucket("demo-laya-v4.firebasestorage.app")
    .file(path)
    .save(bytes, { metadata: { contentType: "image/jpeg" } });
  return path;
}
before(async () => {
  process.env.GCLOUD_PROJECT = "demo-laya-v4";
  env = await initializeTestEnvironment({
    projectId: "demo-laya-v4",
    firestore: {
      rules: fs.readFileSync("firebase-rules/firestore.rules", "utf8"),
    },
    storage: { rules: fs.readFileSync("firebase-rules/storage.rules", "utf8") },
  });
  ({ password } = await seed());
  jpeg = await sharp({
    create: { width: 40, height: 30, channels: 3, background: "#d8c09b" },
  })
    .jpeg()
    .toBuffer();
});
after(async () => {
  await Promise.all(clients.map(deleteApp));
  await env.cleanup();
});
test("checklist photo attachment uses manager-only canonical storage", async () => {
  const mgr = await client("test-manager"),
    staff = await client("test-staff"),
    requestId = "checklist-photo-test";
  await photo("test-manager", requestId);
  const base = {
    outlet: "Banquet",
    date: D.day(),
    shift: "Afternoon",
    requestId,
  };
  await assert.rejects(
    staff("uploadChecklistPhoto", base),
    (e) => e.code === "functions/permission-denied",
  );
  const result = await mgr("uploadChecklistPhoto", base);
  assert.match(result.photoPath, /^checklistEvidence\/Banquet_/);
  const meta = await adminStorage()
    .bucket("demo-laya-v4.firebasestorage.app")
    .file(result.photoPath)
    .getMetadata();
  assert.equal(meta[0].metadata?.firebaseStorageDownloadTokens, undefined);
  await assertFails(
    getBytes(
      ref(
        env
          .authenticatedContext("test-staff")
          .storage("gs://demo-laya-v4.firebasestorage.app"),
        result.photoPath,
      ),
    ),
  );
  const model = {
    sections: [
      {
        title: "Evidence",
        items: [
          {
            id: "1",
            text: "Test",
            status: "completed",
            photoPath: result.photoPath,
          },
        ],
      },
    ],
  };
  await mgr("checklist", { ...base, save: true, version: 0, model });
  assert.equal(
    (await mgr("checklist", base)).model.sections[0].items[0].photoPath,
    result.photoPath,
  );
});
test("Firestore rules deny forged approval, role/points changes, manager direct writes, other profiles, anonymous reads", async () => {
  const staff = env.authenticatedContext("test-staff").firestore(),
    mgr = env.authenticatedContext("test-manager").firestore(),
    anon = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(staff, "staff/test-staff")));
  await assertFails(getDoc(doc(staff, "staff/test-other")));
  await assertFails(getDocs(collection(staff, "staff")));
  await assertFails(getDoc(doc(anon, "staff/test-staff")));
  for (const c of [staff, mgr]) {
    await assertFails(
      setDoc(doc(c, "submissions/forged"), {
        staffUid: "test-staff",
        status: "approved",
      }),
    );
    await assertFails(
      setDoc(doc(c, "staff/test-staff"), { role: "manager", points: 999 }),
    );
  }
  await assertSucceeds(getDocs(collection(mgr, "staff")));
});
test("Storage rules enforce ownership, JPEG size, immutable drafts and final evidence", async () => {
  const staff = env
      .authenticatedContext("test-staff")
      .storage("gs://demo-laya-v4.firebasestorage.app"),
    other = env
      .authenticatedContext("test-other")
      .storage("gs://demo-laya-v4.firebasestorage.app");
  const r = ref(staff, "drafts/test-staff/rules-request/0.jpg");
  await assertSucceeds(uploadBytes(r, jpeg, { contentType: "image/jpeg" }));
  await assertFails(uploadBytes(r, jpeg, { contentType: "image/jpeg" }));
  await assertFails(deleteObject(r));
  await assertFails(
    uploadBytes(ref(other, "drafts/test-staff/rules-request/1.jpg"), jpeg, {
      contentType: "image/jpeg",
    }),
  );
  await assertFails(
    uploadBytes(ref(staff, "drafts/test-staff/rules-request/2.jpg"), jpeg, {
      contentType: "text/html",
    }),
  );
  await assertFails(
    uploadBytes(
      ref(staff, "drafts/test-staff/rules-request/3.jpg"),
      new Uint8Array(2097153),
      { contentType: "image/jpeg" },
    ),
  );
  await assertFails(
    uploadBytes(ref(staff, "evidence/test-staff/sub/req/0.jpg"), jpeg, {
      contentType: "image/jpeg",
    }),
  );
});
test("callable authorization, sanitization and assignment checks", async () => {
  const staff = await client("test-staff"),
    anon = await client("");
  await assert.rejects(
    anon("dashboard", {}),
    (e) => e.code === "functions/unauthenticated",
  );
  await assert.rejects(
    staff("managerData", {}),
    (e) => e.code === "functions/permission-denied",
  );
  await getFirestore()
    .doc("staff/test-staff")
    .update({ sharedLeaderboard: [{ private: "employee" }] });
  assert.equal((await staff("profile", {})).sharedLeaderboard, undefined);
  await assertFails(
    getDoc(
      doc(
        env.authenticatedContext("test-staff").firestore(),
        "staff/test-staff",
      ),
    ),
  );
  const other = await client("test-other");
  await assert.rejects(
    other("submitWork", {
      taskId: "task1",
      requestId: "other-request",
      photoPaths: [],
    }),
    (e) => e.code === "functions/permission-denied",
  );
  await assert.rejects(
    staff("submitWork", {
      taskId: "task1",
      requestId: "invalid-content",
      photoPaths: [
        await photo(
          "test-staff",
          "invalid-content",
          Buffer.from("<svg>bad</svg>"),
        ),
      ],
    }),
    (e) => e.code === "functions/invalid-argument",
  );
});
test("three simultaneous submissions allow exactly two, retry is idempotent, server ignores forged state/date/points", async () => {
  const staff = await client("test-staff");
  const paths = await Promise.all(
    [1, 2, 3].map((i) => photo("test-staff", "concurrent-" + i)),
  );
  const results = await Promise.allSettled(
    [1, 2, 3].map((i) =>
      staff("submitWork", {
        taskId: "task" + i,
        requestId: "concurrent-" + i,
        photoPaths: [paths[i - 1]],
        status: "approved",
        date: "2000-01-01",
        pointsAwarded: true,
      }),
    ),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 2);
  assert.equal(
    results.filter(
      (r) =>
        r.status === "rejected" &&
        r.reason.code === "functions/resource-exhausted",
    ).length,
    1,
  );
  const docs = (
    await getFirestore()
      .collection("submissions")
      .where("staffUid", "==", "test-staff")
      .get()
  ).docs;
  assert.equal(docs.length, 2);
  for (const d of docs) {
    assert.equal(d.data().status, "waiting");
    assert.equal(d.data().date, D.day());
    assert.equal(d.data().pointsAwarded, false);
  }
  const s = docs[0].data();
  const repeated = await staff("submitWork", {
    taskId: s.taskId,
    requestId: s.requestId,
    photoPaths: [],
  });
  assert.ok(repeated.duplicate);
  const otherStorage = env
    .authenticatedContext("test-other")
    .storage("gs://demo-laya-v4.firebasestorage.app");
  await assertFails(getBytes(ref(otherStorage, s.photoPath)));
  const ownerStorage = env
    .authenticatedContext("test-staff")
    .storage("gs://demo-laya-v4.firebasestorage.app");
  await assertSucceeds(getBytes(ref(ownerStorage, s.photoPath)));
});
test("concurrent approval awards exactly once; reject requires reason; explicit reopen retains history and quota", async () => {
  const mgr = await client("test-manager"),
    staff = await client("test-staff");
  const docs = (
    await getFirestore()
      .collection("submissions")
      .where("staffUid", "==", "test-staff")
      .get()
  ).docs;
  const first = docs[0],
    second = docs[1];
  await assert.rejects(
    staff("reviewSubmission", { id: first.id, status: "approved" }),
    (e) => e.code === "functions/permission-denied",
  );
  await Promise.all(
    Array.from({ length: 4 }, () =>
      mgr("reviewSubmission", { id: first.id, status: "approved" }),
    ),
  );
  assert.equal(
    (await getFirestore().doc("staff/test-staff").get()).data().points,
    D.points(first.data().priority),
  );
  assert.equal(
    (await getFirestore().collection("pointTransactions").get()).size,
    1,
  );
  await assert.rejects(
    mgr("reviewSubmission", { id: second.id, status: "rejected" }),
    (e) => e.code === "functions/invalid-argument",
  );
  await mgr("reviewSubmission", {
    id: second.id,
    status: "rejected",
    reason: "ถ่ายรูปให้เห็นพื้นที่ครบ",
  });
  await mgr("reviewSubmission", { id: second.id, status: "reopened" });
  const path = await photo("test-staff", "resubmit-request");
  await staff("submitWork", {
    taskId: second.data().taskId,
    requestId: "resubmit-request",
    photoPaths: [path],
  });
  assert.equal((await second.ref.get()).data().revision, 2);
  assert.equal((await second.ref.collection("revisions").get()).size, 1);
  assert.equal(
    (
      await getFirestore().doc(`dailyQuotas/${D.day()}__test-staff`).get()
    ).data().count,
    2,
  );
});
test("legacy quota backfill and pointsAwarded compatibility", async () => {
  const db = getFirestore();
  await db.doc("tasks/legacytask").set({
    title: "legacy",
    active: true,
    assignedTo: "test-other",
    requiredPhoto: false,
  });
  for (let i = 0; i < 2; i++)
    await db.doc(`submissions/legacy-${i}`).set({
      staffUid: "test-other",
      taskId: "old" + i,
      date: D.day(),
      status: "waiting",
      pointsAwarded: true,
      priority: "High",
    });
  const other = await client("test-other"),
    mgr = await client("test-manager");
  await assert.rejects(
    other("submitWork", {
      taskId: "legacytask",
      requestId: "legacy-limit",
      photoPaths: [],
    }),
    (e) => e.code === "functions/resource-exhausted",
  );
  await mgr("reviewSubmission", { id: "legacy-0", status: "approved" });
  assert.equal((await db.doc("staff/test-other").get()).data().points, 0);
});
test("checklist optimistic concurrency preserves original document/history", async () => {
  const mgr = await client("test-manager"),
    base = { outlet: "The Taste", shift: "Morning", date: D.day() },
    m = {
      sections: [
        {
          title: "Existing item",
          items: [
            {
              id: "1.1",
              text: "Original text",
              status: "na",
              responsible: "A",
              remark: "note",
              actionBy: "K.Noi",
              followUp: "open",
            },
          ],
        },
      ],
    };
  await mgr("checklist", { ...base, save: true, model: m, version: 0 });
  await assert.rejects(
    mgr("checklist", { ...base, save: true, model: m, version: 0 }),
    (e) => e.code === "functions/aborted",
  );
  const read = await mgr("checklist", base);
  assert.equal(read.model.sections[0].items[0].status, "na");
  assert.equal(read.version, 1);
  await mgr("checklist", { ...base, save: true, model: m, version: 1 });
});
test("disabled accounts and manager account escalation are denied", async () => {
  const mgr = await client("test-manager"),
    other = await client("test-other");
  await assert.rejects(
    mgr("saveStaff", { id: "test-manager", name: "Escalate", active: true }),
    (e) => e.code === "functions/permission-denied",
  );
  await mgr("saveStaff", { id: "test-other", name: "Disabled", active: false });
  await assert.rejects(
    other("dashboard", {}),
    (e) => e.code === "functions/permission-denied",
  );
  await assertFails(
    getDoc(
      doc(
        env.authenticatedContext("test-other").firestore(),
        "staff/test-other",
      ),
    ),
  );
  await getFirestore().doc("staff/test-other").update({ active: true });
});

test("evidence status endpoint enforces role and owner without exposing other paths", async () => {
  const staff = await client("test-staff"),
    manager = await client("test-manager"),
    anonymous = await client(null);
  const foreign =
    "evidence/test-other/2026-11-06__test-other__task1/retention-access-test/0.jpg";
  await assert.rejects(
    staff("evidenceStatus", { paths: [foreign] }),
    (e) => e.code === "functions/permission-denied",
  );
  await assert.rejects(
    anonymous("evidenceStatus", { paths: [foreign] }),
    (e) => e.code === "functions/unauthenticated",
  );
  await assert.rejects(
    manager("evidenceStatus", { paths: ["assets/private.jpg"] }),
    (e) => e.code === "functions/permission-denied",
  );
  await assert.rejects(
    staff("evidenceStatus", {
      paths: [
        "checklistEvidence/The_Taste_2026-11-06_Morning/retention-access.jpg",
      ],
    }),
    (e) => e.code === "functions/permission-denied",
  );
  const own =
    "evidence/test-staff/2026-11-06__test-staff__task1/retention-access-test/0.jpg";
  await getFirestore()
    .doc("evidenceRetention/" + R.key(own))
    .set({ path: own, state: "deleted", policyHours: 168 });
  assert.equal(
    (await staff("evidenceStatus", { paths: [own] }))[0].state,
    "expired",
  );
  assert.equal(
    (await manager("evidenceStatus", { paths: [own] }))[0].state,
    "expired",
  );
});

test("registration cannot elevate existing identities and password reset requires manager", async () => {
  const mgr = await client("test-manager"),
    staff = await client("test-staff"),
    anon = await client();
  await assert.rejects(() =>
    anon("registerStaff", { name: "Forged", role: "manager", active: true }),
  );
  await assert.rejects(() =>
    staff("resetStaffPassword", {
      id: "test-manager",
      password: "malicious-password",
    }),
  );
  await assert.rejects(() =>
    mgr("resetStaffPassword", {
      id: "test-manager",
      password: "malicious-password",
    }),
  );
  const before = (await getFirestore().doc("staff/test-staff").get()).data();
  await staff("registerStaff", {
    name: "Forged",
    role: "manager",
    active: true,
    points: 999,
  });
  assert.deepEqual(
    (await getFirestore().doc("staff/test-staff").get()).data(),
    before,
  );
});

test("new signup ignores forged privileges and remains inaccessible until approval", async () => {
  const staffID = "pending-security";
  const user = await adminAuth().createUser({
    email: staffID + "@laya.local",
    password,
  });
  const pending = await client(staffID);
  await pending("registerStaff", {
    name: "Pending",
    role: "manager",
    active: true,
    points: 9000,
  });
  const profile = (
    await getFirestore()
      .doc("staff/" + user.uid)
      .get()
  ).data();
  assert.equal(profile.role, "staff");
  assert.equal(profile.active, false);
  assert.equal(profile.points, 0);
  await assert.rejects(
    () => pending("dashboard"),
    (e) => e.code === "functions/permission-denied",
  );
  await assertFails(
    getDoc(
      doc(env.authenticatedContext(user.uid).firestore(), "staff/" + user.uid),
    ),
  );
  const manager = await client("test-manager");
  await assert.rejects(
    () => manager("resetStaffPassword", { id: user.uid, password: "short" }),
    (e) => e.code === "functions/invalid-argument",
  );
});
