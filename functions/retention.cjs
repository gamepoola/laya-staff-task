"use strict";
const { createHash, randomUUID } = require("node:crypto");
const HOURS = 168,
  AGE = HOURS * 3600000;
const PREFIXES = ["evidence/", "checklistEvidence/", "drafts/"];
const key = (path) => createHash("sha256").update(path).digest("hex");
function classify(path) {
  let m;
  if (
    (m =
      /^drafts\/([A-Za-z0-9_.-]{1,160})\/([A-Za-z0-9_-]{8,100})\/[0-9]\.jpg$/.exec(
        path,
      ))
  )
    return { kind: "draft", owner: m[1] };
  if (
    (m =
      /^evidence\/([A-Za-z0-9_.-]{1,160})\/(\d{4}-\d{2}-\d{2}__[A-Za-z0-9_.-]+)\/([A-Za-z0-9_-]{8,100})\/[0-9]\.jpg$/.exec(
        path,
      )) &&
    m[2].startsWith(m[2].slice(0, 10) + "__" + m[1] + "__")
  )
    return { kind: "task", owner: m[1] };
  if (
    /^checklistEvidence\/[\p{L}\p{N}_-]+_\d{4}-\d{2}-\d{2}_(Morning|Afternoon)\/[A-Za-z0-9_-]{8,100}\.jpg$/u.test(
      path,
    )
  )
    return { kind: "checklist" };
  return null;
}
function eligible(path, m, now) {
  const type = classify(path),
    created = Date.parse(m.timeCreated);
  if (
    !type ||
    m.name !== path ||
    m.contentType !== "image/jpeg" ||
    !(Number(m.size) > 0 && Number(m.size) <= 2097152) ||
    !/^\d+$/.test(String(m.generation)) ||
    !Number.isFinite(created) ||
    created > now ||
    m.temporaryHold ||
    m.eventBasedHold ||
    m.retention?.mode
  )
    return null;
  return {
    ...type,
    created,
    expired: now - created >= AGE,
    generation: String(m.generation),
  };
}
function assertBucketPolicy(m) {
  if (
    Number(m.softDeletePolicy?.retentionDurationSeconds || 0) > 0 ||
    m.versioning?.enabled ||
    m.retentionPolicy ||
    m.defaultEventBasedHold ||
    m.lifecycle?.rule?.length
  )
    throw Error(
      "Bucket retention/version/lifecycle policy requires owner review; deletion refused",
    );
}
// Only this module writes deletion receipts. No business collections are modified.
async function runCleanup({
  db,
  bucket,
  dryRun = true,
  now = Date.now(),
  pageSize = 100,
  maxPages = 1000,
  deadlineMs = 420000,
  log = () => {},
}) {
  const token = randomUUID(),
    lock = db.doc("maintenance/evidenceCleanup"),
    start = Date.now();
  const result = {
    dryRun,
    scanned: 0,
    eligible: 0,
    deleted: 0,
    changed: 0,
    invalid: 0,
    young: 0,
    complete: true,
    objects: [],
  };
  let state = {};
  if (!dryRun) {
    const acquired = await db.runTransaction(async (tx) => {
      const s = (await tx.get(lock)).data() || {};
      if (s.leaseUntil > Date.now()) return false;
      state = s;
      tx.set(lock, { ...s, token, leaseUntil: Date.now() + 12 * 60000 });
      return true;
    });
    if (!acquired) return { ...result, locked: true, complete: false };
  }
  const renew = async (update) => {
    if (dryRun) return;
    await db.runTransaction(async (tx) => {
      const s = (await tx.get(lock)).data();
      if (s?.token !== token) throw Error("Cleanup lease lost");
      tx.update(lock, { ...update, leaseUntil: Date.now() + 12 * 60000 });
    });
  };
  const markDeleted = async (ref, m) =>
    ref.set({ ...m, state: "deleted", deletedAt: new Date().toISOString() });
  try {
    // Recover deletion receipts after a crash between Storage delete and Firestore commit.
    if (!dryRun) {
      const pending = await db
        .collection("evidenceRetention")
        .where("state", "==", "deleting")
        .limit(100)
        .get();
      for (const doc of pending.docs) {
        const r = doc.data();
        if (!classify(r.path)) continue;
        try {
          const [m] = await bucket.file(r.path).getMetadata();
          if (String(m.generation) !== r.generation)
            await markDeleted(doc.ref, r);
        } catch (e) {
          if (Number(e.code) === 404) await markDeleted(doc.ref, r);
          else throw e;
        }
      }
    }
    let pages = 0;
    for (
      let i = dryRun ? 0 : state.prefixIndex || 0;
      i < PREFIXES.length;
      i++
    ) {
      let pageToken =
        !dryRun && i === (state.prefixIndex || 0)
          ? state.pageToken || undefined
          : undefined;
      do {
        await renew({ prefixIndex: i, pageToken: pageToken || null });
        const [files, next] = await bucket.getFiles({
          prefix: PREFIXES[i],
          maxResults: Math.min(100, Math.max(1, pageSize)),
          autoPaginate: false,
          pageToken,
        });
        for (const file of files) {
          result.scanned++;
          const [m] = await file
            .getMetadata()
            .catch((e) =>
              Number(e.code) === 404 ? [null] : Promise.reject(e),
            );
          if (!m) continue;
          const candidate = eligible(file.name, m, now);
          if (!candidate) {
            result.invalid++;
            continue;
          }
          if (!candidate.expired) {
            result.young++;
            continue;
          }
          result.eligible++;
          const receipt = {
            path: file.name,
            generation: candidate.generation,
            createdAt: m.timeCreated,
            policyHours: HOURS,
            kind: candidate.kind,
          };
          if (result.objects.length < 1000) result.objects.push(receipt);
          if (dryRun) continue;
          await renew({});
          const ref = db.doc("evidenceRetention/" + key(file.name));
          await ref.set({ ...receipt, state: "deleting" });
          try {
            await file.delete({ ifGenerationMatch: candidate.generation });
            await markDeleted(ref, receipt);
            result.deleted++;
            log({
              event: "evidence.deleted",
              object: key(file.name),
              generation: candidate.generation,
              policyHours: HOURS,
            });
          } catch (e) {
            if (Number(e.code) === 404) {
              await markDeleted(ref, receipt);
              continue;
            }
            if (Number(e.code) === 412) {
              result.changed++;
              await ref.set({ ...receipt, state: "generation-changed" });
              continue;
            }
            throw e;
          }
        }
        pageToken = next?.pageToken;
        pages++;
        await renew({
          prefixIndex: pageToken ? i : i + 1,
          pageToken: pageToken || null,
        });
        if (pages >= maxPages || Date.now() - start > deadlineMs) {
          result.complete = !pageToken && i === PREFIXES.length - 1;
          return result;
        }
      } while (pageToken);
    }
    await renew({ prefixIndex: 0, pageToken: null });
    return result;
  } catch (e) {
    result.complete = false;
    result.failed = true;
    throw e;
  } finally {
    const { objects, ...summary } = result;
    if (!dryRun)
      await db
        .runTransaction(async (tx) => {
          const s = (await tx.get(lock)).data();
          if (s?.token === token)
            tx.update(lock, {
              leaseUntil: 0,
              token: null,
              lastRunAt: new Date().toISOString(),
              lastSummary: summary,
            });
        })
        .catch(async (e) => {
          log({ event: "cleanup.release-failed", message: e.message });
          throw e;
        });
    log({ event: "cleanup.summary", ...result, objects: undefined });
  }
}
async function evidenceStatus({ db, bucket, path, now = Date.now() }) {
  try {
    const [m] = await bucket.file(path).getMetadata();
    const created = Date.parse(m.timeCreated);
    return {
      path,
      state: "available",
      expiresAt: Number.isFinite(created)
        ? new Date(created + AGE).toISOString()
        : null,
      approaching: Number.isFinite(created) && now >= created + AGE - 86400000,
    };
  } catch (e) {
    if (Number(e.code) !== 404) throw e;
    const r = (await db.doc("evidenceRetention/" + key(path)).get()).data();
    return {
      path,
      state:
        r && ["deleted", "deleting"].includes(r.state) ? "expired" : "missing",
    };
  }
}
module.exports = {
  AGE,
  HOURS,
  PREFIXES,
  key,
  classify,
  eligible,
  assertBucketPolicy,
  runCleanup,
  evidenceStatus,
};
