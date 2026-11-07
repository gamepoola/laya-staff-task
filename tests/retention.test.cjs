const { test, before } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
const R = require("../functions/retention.cjs");
const { seed, guard } = require("../tools/seed.cjs");
const { getFirestore, getStorage } = require("../functions/sdk.cjs");
let db, bucket;
const path =
  "evidence/test-staff/2026-11-06__test-staff__retention/retention-request/0.jpg";
before(async () => {
  process.env.GCLOUD_PROJECT = "demo-laya-v4";
  guard();
  await seed();
  db = getFirestore();
  bucket = getStorage().bucket("demo-laya-v4.firebasestorage.app");
  await db.recursiveDelete(db.collection("evidenceRetention"));
  await db.doc("maintenance/evidenceCleanup").delete();
});
async function put(name) {
  await bucket.file(name).save(Buffer.from("synthetic jpeg fixture"), {
    resumable: false,
    metadata: {
      contentType: "image/jpeg",
      cacheControl: "private, no-store",
    },
  });
  return (await bucket.file(name).getMetadata())[0];
}
test("strict path, metadata, boundary and bucket safeguards", () => {
  const m = {
    name: path,
    timeCreated: "2026-01-01T00:00:00Z",
    generation: "1",
    contentType: "image/jpeg",
    size: "100",
  };
  assert.equal(
    R.eligible(path, m, Date.parse(m.timeCreated) + R.AGE - 1).expired,
    false,
  );
  assert.equal(
    R.eligible(path, m, Date.parse(m.timeCreated) + R.AGE).expired,
    true,
  );
  for (const bad of [
    "assets/logo.jpg",
    "profiles/test-staff/0.jpg",
    "evidence/test-staff/other/retention-request/0.jpg",
    "drafts/test-staff/../0.jpg",
  ])
    assert.equal(R.classify(bad), null);
  assert.equal(
    R.eligible(path, { ...m, contentType: "text/plain" }, Date.now()),
    null,
  );
  assert.equal(
    R.eligible(path, { ...m, temporaryHold: true }, Date.now()),
    null,
  );
  assert.throws(() =>
    R.assertBucketPolicy({
      softDeletePolicy: { retentionDurationSeconds: "604800" },
    }),
  );
  assert.throws(() => R.assertBucketPolicy({ versioning: { enabled: true } }));
  R.assertBucketPolicy({});
});
test("emulator: dry run, age, pagination, pending/rejected policy, history and points unchanged, retry", async () => {
  const m = await put(path),
    draft = "drafts/test-staff/retention-draft/0.jpg",
    check =
      "checklistEvidence/The_Taste_2026-11-06_Morning/retention-check.jpg";
  await put(draft);
  await put(check);
  await put("assets/keep-retention.jpg");
  await put("profiles/keep-retention.jpg");
  await db
    .doc("submissions/retention-pending")
    .set({ status: "waiting", photoPath: path, staffUid: "test-staff" });
  await db.doc("submissions/retention-rejected").set({
    status: "rejected",
    photoPath: path,
    staffUid: "test-staff",
    rejectionReason: "retain history",
  });
  await db
    .doc("submissions/retention-pending/approvals/history")
    .set({ reason: "history" });
  await db
    .doc("pointTransactions/retention")
    .set({ staffUid: "test-staff", value: 2 });
  const staff = (await db.doc("staff/test-staff").get()).data();
  const young = await R.runCleanup({
    db,
    bucket,
    dryRun: false,
    now: Date.parse(m.timeCreated) + R.AGE - 1,
    pageSize: 2,
  });
  assert.equal((await bucket.file(path).exists())[0], true);
  const future = Date.now() + R.AGE + 1000;
  const dry = await R.runCleanup({
    db,
    bucket,
    dryRun: true,
    now: future,
    pageSize: 2,
  });
  assert.ok(dry.eligible >= 3);
  assert.equal((await bucket.file(path).exists())[0], true);
  fs.writeFileSync(
    "docs/CLEANUP_DRY_RUN.json",
    JSON.stringify(
      {
        note: "Synthetic emulator only; clock advanced 168h+ to test actual Storage timeCreated",
        ...dry,
      },
      null,
      2,
    ),
  );
  const done = await R.runCleanup({
    db,
    bucket,
    dryRun: false,
    now: future,
    pageSize: 2,
  });
  assert.ok(done.deleted >= 3);
  assert.equal(done.complete, true);
  for (const n of [path, draft, check])
    assert.equal((await bucket.file(n).exists())[0], false);
  for (const n of ["assets/keep-retention.jpg", "profiles/keep-retention.jpg"])
    assert.equal((await bucket.file(n).exists())[0], true);
  assert.equal((await R.evidenceStatus({ db, bucket, path })).state, "expired");
  assert.equal(
    (await db.doc("submissions/retention-pending").get()).data().status,
    "waiting",
  );
  assert.equal(
    (await db.doc("submissions/retention-rejected").get()).data()
      .rejectionReason,
    "retain history",
  );
  assert.equal(
    (await db.doc("submissions/retention-pending/approvals/history").get())
      .exists,
    true,
  );
  assert.deepEqual((await db.doc("staff/test-staff").get()).data(), staff);
  assert.equal(
    (await db.doc("pointTransactions/retention").get()).data().value,
    2,
  );
  assert.equal(
    (await R.runCleanup({ db, bucket, dryRun: false, now: future })).deleted,
    0,
  );
});
test("emulator: concurrent lease, missing receipt recovery, newly uploaded replacement protected", async () => {
  await db
    .doc("maintenance/evidenceCleanup")
    .set({ token: "other", leaseUntil: Date.now() + 60000 });
  assert.equal(
    (await R.runCleanup({ db, bucket, dryRun: false })).locked,
    true,
  );
  await db.doc("maintenance/evidenceCleanup").delete();
  await db.doc("evidenceRetention/" + R.key(path)).set({
    path,
    generation: "123",
    createdAt: "2026-01-01T00:00:00Z",
    state: "deleting",
    policyHours: 168,
  });
  await R.runCleanup({ db, bucket, dryRun: false });
  assert.equal(
    (await db.doc("evidenceRetention/" + R.key(path)).get()).data().state,
    "deleted",
  );
  await put(path);
  await R.runCleanup({ db, bucket, dryRun: false });
  assert.equal((await bucket.file(path).exists())[0], true);
  assert.equal(
    (await R.evidenceStatus({ db, bucket, path })).state,
    "available",
  );
});
test("generation precondition adapter: replacement between metadata and delete produces 412, never unconditional delete", async () => {
  const m = await put(path);
  let checked = false;
  const adapter = {
    file: (n) => bucket.file(n),
    getFiles: async (opts) => {
      if (opts.prefix !== "evidence/") return [[], {}];
      return [
        [
          {
            name: path,
            getMetadata: async () => [m],
            delete: async (opts) => {
              assert.equal(opts.ifGenerationMatch, String(m.generation));
              checked = true;
              const e = Error("replacement");
              e.code = 412;
              throw e;
            },
          },
        ],
        {},
      ];
    },
  };
  const result = await R.runCleanup({
    db,
    bucket: adapter,
    dryRun: false,
    now: Date.parse(m.timeCreated) + R.AGE + 1,
  });
  assert.equal(checked, true);
  assert.equal(result.changed, 1);
  assert.equal((await bucket.file(path).exists())[0], true);
});

test("warning threshold uses authoritative creation time and bounded scan resumes", async () => {
  const m = await put(path),
    created = Date.parse(m.timeCreated);
  assert.equal(
    (
      await R.evidenceStatus({
        db,
        bucket,
        path,
        now: created + R.AGE - 86400001,
      })
    ).approaching,
    false,
  );
  assert.equal(
    (
      await R.evidenceStatus({
        db,
        bucket,
        path,
        now: created + R.AGE - 86400000,
      })
    ).approaching,
    true,
  );
  const partial = await R.runCleanup({
    db,
    bucket,
    dryRun: false,
    now: created + R.AGE + 1000,
    maxPages: 1,
    pageSize: 1,
  });
  assert.equal(partial.complete, false);
  const resumed = await R.runCleanup({
    db,
    bucket,
    dryRun: false,
    now: created + R.AGE + 1000,
  });
  assert.equal(resumed.complete, true);
  assert.equal((await bucket.file(path).exists())[0], false);
});
