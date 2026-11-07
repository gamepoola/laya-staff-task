const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto"),
  fs = require("node:fs");
const {
    initializeApp,
    getFirestore,
    Timestamp,
  } = require("../functions/sdk.cjs"),
  B = require("../tools/records-backup.cjs"),
  S = require("../tools/prepare-staging.cjs");
test("staging guard rejects production, mismatched bucket and unfilled settings", () => {
  const c = {
    environment: "staging",
    region: "us-central1",
    appCheckSiteKey: "synthetic-key",
    firebase: {
      projectId: "laya-test-staging",
      storageBucket: "laya-test-staging.firebasestorage.app",
      authDomain: "laya-test-staging.firebaseapp.com",
      apiKey: "synthetic",
      appId: "synthetic",
    },
  };
  assert.equal(S.validate(c), "laya-test-staging");
  assert.throws(() =>
    S.validate({
      ...c,
      firebase: { ...c.firebase, projectId: "laya-staff-task-us" },
    }),
  );
  assert.throws(() =>
    S.validate({
      ...c,
      firebase: { ...c.firebase, storageBucket: "production-bucket" },
    }),
  );
  assert.throws(() => S.validate({ ...c, appCheckSiteKey: "" }));
});
test("encrypted records-only backup restores timestamps, relations, points, approvals and checklist history in isolated emulator", async () => {
  const src = getFirestore(
      initializeApp({ projectId: "demo-laya-backup-source" }, "backup-source"),
    ),
    dst = getFirestore(
      initializeApp({ projectId: "demo-laya-backup-target" }, "backup-target"),
    );
  B.guard(src.projectId);
  B.guard(dst.projectId);
  for (const db of [src, dst])
    for (const col of await db.listCollections()) await db.recursiveDelete(col);
  const data = {
    "staff/worker": { points: 2, role: "staff" },
    "tasks/task": { assignedTo: "worker" },
    "submissions/sub": {
      staffUid: "worker",
      taskId: "task",
      status: "approved",
      photoPath: "evidence/expired.jpg",
    },
    "submissions/sub/approvals/one": {
      at: Timestamp.now(),
      managerUid: "manager",
      status: "approved",
    },
    "pointTransactions/sub": { staffUid: "worker", value: 2 },
    "manager_checklists/day": { revision: 2, sections: [] },
    "manager_checklists/day/history/one": { revision: 1 },
    "evidenceRetention/receipt": { state: "deleted", policyHours: 168 },
  };
  for (const [p, d] of Object.entries(data)) await src.doc(p).set(d);
  const original = await B.snapshot(src),
    password = crypto.randomBytes(24).toString("hex"),
    encrypted = B.encrypt(original, password);
  assert.equal(encrypted.includes("worker"), false);
  assert.throws(() => B.decrypt(encrypted, password + "wrong"));
  const n = await B.restore(dst, B.decrypt(encrypted, password));
  assert.equal(n, 8);
  const copied = await B.snapshot(dst);
  assert.deepEqual(copied.records, original.records);
  assert.equal(
    (await dst.doc("staff/worker").get()).data().points,
    (await dst.doc("pointTransactions/sub").get()).data().value,
  );
  assert.equal(
    (await dst.doc("submissions/sub/approvals/one").get()).data().at instanceof
      Timestamp,
    true,
  );
  assert.equal(
    (await dst.doc("evidenceRetention/receipt").get()).data().state,
    "deleted",
  );
  await assert.rejects(() => B.restore(dst, original), /not empty/);
  fs.writeFileSync(
    "docs/RESTORE_REHEARSAL.json",
    JSON.stringify(
      {
        source: src.projectId,
        target: dst.projectId,
        records: n,
        encryption: "AES-256-GCM",
        exactMatch: true,
        photosIncluded: false,
        pointsMatched: true,
        historyMatched: true,
      },
      null,
      2,
    ),
  );
});

test("staging artifact is isolated, defaults to dry-run and excludes local endpoints", () => {
  const os = require("node:os"),
    path = require("node:path");
  const folder = fs.mkdtempSync(
      path.join(os.tmpdir(), "laya-stage-rehearsal-"),
    ),
    config = path.join(folder, "config.json"),
    output = path.join(folder, "artifact");
  fs.writeFileSync(
    config,
    JSON.stringify({
      environment: "staging",
      region: "us-central1",
      appCheckSiteKey: "synthetic-key",
      firebase: {
        projectId: "laya-rehearsal-staging",
        storageBucket: "laya-rehearsal-staging.firebasestorage.app",
        authDomain: "laya-rehearsal-staging.firebaseapp.com",
        apiKey: "synthetic",
        appId: "synthetic",
      },
    }),
  );
  S.prepare(config, output);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(output, ".firebaserc"))).projects
      .default,
    "laya-rehearsal-staging",
  );
  assert.ok(
    fs
      .readFileSync(
        path.join(output, "functions/.env.laya-rehearsal-staging"),
        "utf8",
      )
      .includes("CLEANUP_MODE=dry-run"),
  );
  assert.ok(
    !fs
      .readFileSync(path.join(output, "firebase.json"), "utf8")
      .includes("127.0.0.1"),
  );
  assert.equal(
    JSON.parse(
      fs.readFileSync(path.join(output, "TARGET_REQUIRES_APPROVAL.json")),
    ).deployed,
    false,
  );
});

test("5-person pilot provisioning is emulator-only and creates staff roles with two outlet tasks", async () => {
  const previous = process.env.GCLOUD_PROJECT;
  process.env.GCLOUD_PROJECT = "demo-laya-pilot";
  try {
    const rows = await require("../tools/seed-pilot.cjs").provision(5);
    assert.equal(rows.length, 6);
    assert.ok(rows.every((r) => r.password.length >= 24));
    const db = getFirestore(
      initializeApp({ projectId: "demo-laya-pilot" }, "pilot-verify"),
    );
    assert.equal(
      (await db.collection("staff").where("role", "==", "staff").get()).size,
      5,
    );
    assert.equal((await db.collection("tasks").get()).size, 2);
    process.env.GCLOUD_PROJECT = "laya-staff-task-us";
    await assert.rejects(() => require("../tools/seed-pilot.cjs").provision(5));
  } finally {
    process.env.GCLOUD_PROJECT = previous;
  }
});
