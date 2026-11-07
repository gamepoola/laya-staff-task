"use strict";
const crypto = require("node:crypto"),
  fs = require("node:fs");
const {
  Timestamp,
  GeoPoint,
  DocumentReference,
} = require("../functions/sdk.cjs");
const COLLECTIONS = [
  "staff",
  "tasks",
  "assignments",
  "submissions",
  "manager_checklists",
  "pointTransactions",
  "dailyQuotas",
  "auditLogs",
  "photoMetadata",
  "evidenceRetention",
  "settings",
];
function guard(project) {
  if (
    !process.env.FIRESTORE_EMULATOR_HOST ||
    !/^demo-laya-[a-z0-9-]+$/.test(project)
  )
    throw Error(
      "Local rehearsal only; explicit demo-laya project and emulator required",
    );
}
function encode(v) {
  if (v instanceof Timestamp)
    return {
      $type: "timestamp",
      seconds: v.seconds,
      nanoseconds: v.nanoseconds,
    };
  if (v instanceof GeoPoint)
    return { $type: "geo", latitude: v.latitude, longitude: v.longitude };
  if (Buffer.isBuffer(v))
    return { $type: "bytes", value: v.toString("base64") };
  if (v instanceof DocumentReference)
    return { $type: "reference", path: v.path };
  if (Array.isArray(v)) return v.map(encode);
  if (v && typeof v === "object")
    return {
      $type: "map",
      value: Object.entries(v).map(([k, x]) => [k, encode(x)]),
    };
  if (typeof v === "number" && !Number.isFinite(v))
    return { $type: "number", value: String(v) };
  return v;
}
function decode(v, db) {
  if (v?.$type === "map")
    return Object.fromEntries(v.value.map(([k, x]) => [k, decode(x, db)]));
  if (v?.$type === "timestamp") return new Timestamp(v.seconds, v.nanoseconds);
  if (v?.$type === "geo") return new GeoPoint(v.latitude, v.longitude);
  if (v?.$type === "bytes") return Buffer.from(v.value, "base64");
  if (v?.$type === "reference") return db.doc(v.path);
  if (v?.$type === "number") return Number(v.value);
  if (Array.isArray(v)) return v.map((x) => decode(x, db));
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) => [k, decode(x, db)]),
    );
  return v;
}
async function snapshot(db) {
  guard(db.projectId);
  const records = [];
  async function collect(col) {
    let cursor;
    do {
      let q = col.orderBy("__name__").limit(100);
      if (cursor) q = q.startAfter(cursor);
      const page = await q.get();
      for (const doc of page.docs) {
        records.push({ path: doc.ref.path, data: encode(doc.data()) });
        for (const child of await doc.ref.listCollections())
          await collect(child);
      }
      cursor = page.size === 100 ? page.docs.at(-1) : null;
    } while (cursor);
  }
  for (const name of COLLECTIONS) await collect(db.collection(name));
  records.sort((a, b) => a.path.localeCompare(b.path));
  return { version: 1, source: db.projectId, photosIncluded: false, records };
}
function encrypt(payload, password) {
  if (typeof password !== "string" || password.length < 16)
    throw Error("Backup passphrase must be at least 16 characters");
  const salt = crypto.randomBytes(16),
    iv = crypto.randomBytes(12),
    key = crypto.scryptSync(password, salt, 32),
    cipher = crypto.createCipheriv("aes-256-gcm", key, iv),
    body = Buffer.concat([
      cipher.update(JSON.stringify(payload), "utf8"),
      cipher.final(),
    ]);
  return JSON.stringify({
    version: 1,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    body: body.toString("base64"),
  });
}
function decrypt(text, password) {
  const e = JSON.parse(text);
  if (e.version !== 1) throw Error("Unsupported backup");
  const cipher = crypto.createDecipheriv(
    "aes-256-gcm",
    crypto.scryptSync(password, Buffer.from(e.salt, "base64"), 32),
    Buffer.from(e.iv, "base64"),
  );
  cipher.setAuthTag(Buffer.from(e.tag, "base64"));
  return JSON.parse(
    Buffer.concat([
      cipher.update(Buffer.from(e.body, "base64")),
      cipher.final(),
    ]).toString("utf8"),
  );
}
async function restore(db, payload) {
  guard(db.projectId);
  if (
    payload.version !== 1 ||
    payload.photosIncluded !== false ||
    payload.source === db.projectId
  )
    throw Error("Restore requires a different isolated target");
  for (const name of COLLECTIONS)
    if (!(await db.collection(name).limit(1).get()).empty)
      throw Error("Target is not empty");
  for (const r of payload.records) {
    if (
      !COLLECTIONS.includes(r.path.split("/")[0]) ||
      r.path.split("/").length % 2
    )
      throw Error("Invalid record scope");
  }
  for (let i = 0; i < payload.records.length; i += 200) {
    const batch = db.batch();
    for (const r of payload.records.slice(i, i + 200))
      batch.create(db.doc(r.path), decode(r.data, db));
    await batch.commit();
  }
  return payload.records.length;
}
module.exports = {
  COLLECTIONS,
  guard,
  encode,
  decode,
  snapshot,
  encrypt,
  decrypt,
  restore,
};
if (require.main === module)
  (async () => {
    const [action, project, file] = process.argv.slice(2);
    guard(project);
    const { initializeApp, getFirestore } = require("../functions/sdk.cjs");
    const db = getFirestore(
      initializeApp({ projectId: project }, "backup-cli"),
    );
    if (action === "export") {
      if (fs.existsSync(file)) throw Error("Backup exists");
      fs.writeFileSync(
        file,
        encrypt(await snapshot(db), process.env.LAYA_BACKUP_PASSPHRASE),
        { mode: 0o600 },
      );
    } else if (action === "restore") {
      await restore(
        db,
        decrypt(
          fs.readFileSync(file, "utf8"),
          process.env.LAYA_BACKUP_PASSPHRASE,
        ),
      );
    } else throw Error("Use export|restore demo-laya-ID encrypted-file");
    console.log("Records-only rehearsal completed");
  })().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
