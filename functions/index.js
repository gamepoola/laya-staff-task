"use strict";
const {
  initializeApp: initializeAdminApp,
  getApps,
  getApp,
} = require("firebase-admin/app");
const {
  getFirestore,
  FieldValue,
  FieldPath,
} = require("firebase-admin/firestore");
const { getAuth: adminAuth } = require("firebase-admin/auth");
const { getStorage: adminStorage } = require("firebase-admin/storage");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const sharp = require("sharp");
const D = require("./domain.cjs");
const R = require("./retention.cjs");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
initializeAdminApp({
  projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT,
});
setGlobalOptions({ region: "us-central1", maxInstances: 10 });
const db = getFirestore(),
  bucket = () =>
    adminStorage().bucket(
      process.env.EVIDENCE_BUCKET ||
        `${process.env.GCLOUD_PROJECT || getApp().options.projectId}.firebasestorage.app`,
    );
const stamp = () => FieldValue.serverTimestamp();
const fail = (code, message) => {
  throw new HttpsError(code, message);
};
function str(v, max = 200, required = false) {
  if (typeof v !== "string" || v.length > max || (required && !v.trim()))
    fail("invalid-argument", "Invalid text");
  return v.trim();
}
function id(v, max = 160) {
  const s = str(v, max, true);
  if (!/^[a-zA-Z0-9_.-]+$/.test(s)) fail("invalid-argument", "Invalid ID");
  return s;
}
function date(v) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(v || "") ||
    Number.isNaN(Date.parse(v)) ||
    new Date(v).toISOString().slice(0, 10) !== v
  )
    fail("invalid-argument", "Invalid date");
  return v;
}
async function actor(req, manager = false) {
  if (!req.auth) fail("unauthenticated", "Please sign in");
  const snap = await db.doc("staff/" + req.auth.uid).get();
  const p = snap.data();
  if (!p || p.active === false || (manager && p.role !== "manager"))
    fail("permission-denied", "Access denied");
  return { uid: req.auth.uid, ...D.publicProfile(p) };
}
function transactionActor(snap, manager = false) {
  const p = snap.data();
  if (!p || p.active === false || (manager && p.role !== "manager"))
    fail("permission-denied", "Access changed");
  return p;
}
const callable = (fn) =>
  onCall(
    {
      enforceAppCheck: process.env.ENFORCE_APP_CHECK === "true",
      timeoutSeconds: 120,
      memory: "512MiB",
    },
    fn,
  );
function audit(tx, uid, action, target, details = {}) {
  tx.create(db.collection("auditLogs").doc(), {
    uid,
    action,
    target,
    details,
    at: stamp(),
  });
}
function rows(s) {
  return s.docs.map((d) => ({ ...d.data(), id: d.id }));
}
function clean(v) {
  return JSON.parse(JSON.stringify(v));
}
async function bounded(q, max = 2000) {
  const s = await q.limit(max + 1).get();
  if (s.size > max)
    fail("resource-exhausted", "Too much data; narrow the date range");
  return rows(s);
}
exports.profile = callable(async (req) => ({
  ...(await actor(req)),
  today: D.day(),
}));
exports.dashboard = callable(async (req) => {
  const p = await actor(req),
    d = date(req.data?.date || D.day());
  const { Filter } = require("firebase-admin/firestore");
  const targets = [
    Filter.where("assignedTo", "==", "all"),
    Filter.where("assignedTo", "==", p.uid),
  ];
  if (p.department)
    targets.push(
      Filter.and(
        Filter.where("assignedTo", "==", "department"),
        Filter.where("department", "==", p.department),
      ),
    );
  if (p.outlet)
    targets.push(
      Filter.and(
        Filter.where("assignedTo", "==", "outlet"),
        Filter.where("outlet", "==", p.outlet),
      ),
    );
  const tasks = await bounded(
    db
      .collection("tasks")
      .where("active", "==", true)
      .where(Filter.or(...targets)),
  );
  const subs = await bounded(
    db
      .collection("submissions")
      .where("staffUid", "==", p.uid)
      .where("date", "==", d),
    100,
  );
  return clean({
    profile: p,
    date: d,
    tasks: tasks.filter((t) => D.applicable(t, p, p.uid, d)),
    submissions: subs,
    quota: 2,
  });
});
exports.history = callable(async (req) => {
  const p = await actor(req);
  let q = db
    .collection("submissions")
    .where("staffUid", "==", p.uid)
    .orderBy("date", "desc")
    .orderBy(FieldPath.documentId());
  if (req.data?.cursor)
    q = q.startAfter(date(req.data.cursor.date), id(req.data.cursor.id, 500));
  const list = rows(await q.limit(26).get());
  const more = list.length > 25;
  if (more) list.pop();
  return clean({
    rows: list,
    cursor: more ? { date: list.at(-1).date, id: list.at(-1).id } : null,
  });
});
exports.submitWork = callable(async (req) => {
  const p = await actor(req);
  const data = req.data || {},
    taskId = id(data.taskId),
    requestId = id(data.requestId),
    d = D.day(),
    sid = `${d}__${p.uid}__${taskId}`;
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId))
    fail("invalid-argument", "Invalid request ID");
  const note = str(data.note || "", 2000),
    paths = data.photoPaths || [];
  if (
    !Array.isArray(paths) ||
    paths.length > 10 ||
    new Set(paths).size !== paths.length
  )
    fail("invalid-argument", "Invalid photos");
  const prior = await db.doc("submissions/" + sid).get();
  if (prior.exists && prior.data().requestId === requestId)
    return { id: sid, duplicate: true };
  const t = (await db.doc("tasks/" + taskId).get()).data();
  if (!t || !D.applicable(t, p, p.uid, d))
    fail("permission-denied", "Task is not assigned for today");
  if (t.requiredPhoto !== false && !paths.length)
    fail("invalid-argument", "Photo required");
  const finalPaths = [];
  for (let i = 0; i < paths.length; i++) {
    const path = str(paths[i], 500, true);
    if (path !== `drafts/${p.uid}/${requestId}/${i}.jpg`)
      fail("permission-denied", "Invalid photo owner");
    const file = bucket().file(path);
    let meta, bytes;
    try {
      [meta] = await file.getMetadata();
      if (
        Number(meta.size) > 2 * 1024 * 1024 ||
        meta.contentType !== "image/jpeg"
      )
        fail("invalid-argument", "Invalid photo size/type");
      [bytes] = await file.download();
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      fail("failed-precondition", "Photo upload incomplete");
    }
    let safe;
    try {
      const image = sharp(bytes, { limitInputPixels: 25000000 });
      if ((await image.metadata()).format !== "jpeg")
        throw Error("JPEG required");
      safe = await image
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      fail("invalid-argument", "Invalid image content");
    }
    const final = `evidence/${p.uid}/${sid}/${requestId}/${i}.jpg`;
    await bucket()
      .file(final)
      .save(safe, {
        resumable: false,
        metadata: {
          contentType: "image/jpeg",
          cacheControl: "private, no-store",
        },
      });
    finalPaths.push(final);
  }
  await db.runTransaction(async (tx) => {
    const subRef = db.doc("submissions/" + sid),
      quotaRef = db.doc(`dailyQuotas/${d}__${p.uid}`);
    const [ps, ts, ss, qs, legacy] = await Promise.all([
      tx.get(db.doc("staff/" + p.uid)),
      tx.get(db.doc("tasks/" + taskId)),
      tx.get(subRef),
      tx.get(quotaRef),
      tx.get(
        db
          .collection("submissions")
          .where("staffUid", "==", p.uid)
          .where("date", "==", d),
      ),
    ]);
    const current = transactionActor(ps);
    const task = ts.data();
    if (!task || !D.applicable(task, current, p.uid, d))
      fail("permission-denied", "Assignment changed");
    if (task.requiredPhoto !== false && !finalPaths.length)
      fail("failed-precondition", "Photo now required");
    const old = ss.data();
    if (old?.requestId === requestId) return;
    if (old && old.status !== "reopened")
      fail(
        "already-exists",
        "Task already submitted; ask manager to reopen rejected work",
      );
    const used = Math.max(Number(qs.data()?.count || 0), legacy.size);
    if (!old && used >= 2)
      fail("resource-exhausted", "Daily limit: two submissions");
    const revision = (old?.revision || 0) + 1;
    if (old)
      tx.create(db.doc(`submissions/${sid}/revisions/${revision - 1}`), old);
    tx.set(subRef, {
      taskId,
      staffUid: p.uid,
      staffID: current.staffID || "",
      staffName: current.name || "",
      department: current.department || "",
      outlet: current.outlet || "",
      shift: current.shift || "",
      date: d,
      taskTitle: task.title,
      priority: task.priority || "Normal",
      note,
      photoPaths: finalPaths,
      photoPath: finalPaths[0] || "",
      photosCount: finalPaths.length,
      status: "waiting",
      requestId,
      revision,
      pointsAwarded: old?.pointsAwarded || false,
      createdAt: old?.createdAt || stamp(),
      updatedAt: stamp(),
    });
    tx.set(quotaRef, {
      staffUid: p.uid,
      date: d,
      count: old ? used : used + 1,
      updatedAt: stamp(),
    });
    audit(tx, p.uid, "submit", sid, { revision, photos: finalPaths.length });
  });
  return { id: sid };
});
exports.reviewSubmission = callable(async (req) => {
  const p = await actor(req, true),
    sid = id(req.data?.id, 500),
    action = req.data?.status,
    reason = str(req.data?.reason || "", 1000);
  if (!["approved", "rejected", "reopened"].includes(action))
    fail("invalid-argument", "Invalid status");
  if (action === "rejected" && !reason)
    fail("invalid-argument", "Rejection reason required");
  await db.runTransaction(async (tx) => {
    const subRef = db.doc("submissions/" + sid),
      ledgerRef = db.doc("pointTransactions/" + sid);
    const [mgr, ss, ls] = await Promise.all([
      tx.get(db.doc("staff/" + p.uid)),
      tx.get(subRef),
      tx.get(ledgerRef),
    ]);
    transactionActor(mgr, true);
    if (!ss.exists) fail("not-found", "Submission missing");
    const s = ss.data();
    if (s.staffUid === p.uid)
      fail("permission-denied", "Cannot review your own work");
    const [owner, taskSnap] = await Promise.all([
      tx.get(db.doc("staff/" + s.staffUid)),
      tx.get(db.doc("tasks/" + id(s.taskId))),
    ]);
    if (s.status === action) return;
    if (
      action === "reopened" ? s.status !== "rejected" : s.status !== "waiting"
    )
      fail("failed-precondition", "Invalid status transition");
    if (action === "reopened" && s.date !== D.day())
      fail(
        "failed-precondition",
        "Reopen only on original day; assign a new follow-up task for older work",
      );
    if (action === "approved" && !owner.exists)
      fail("failed-precondition", "Staff profile missing");
    const award = action === "approved" && !s.pointsAwarded && !ls.exists,
      value = D.points(s.priority || taskSnap.data()?.priority);
    tx.update(subRef, {
      status: action,
      rejectionReason: action === "rejected" ? reason : s.rejectionReason || "",
      reviewerUid: p.uid,
      reviewedAt: stamp(),
      updatedAt: stamp(),
      ...(award ? { pointsAwarded: true, pointsAwardedValue: value } : {}),
    });
    tx.create(subRef.collection("approvals").doc(), {
      status: action,
      reason,
      reviewerUid: p.uid,
      at: stamp(),
    });
    if (award) {
      tx.create(ledgerRef, {
        staffUid: s.staffUid,
        submissionId: sid,
        value,
        at: stamp(),
      });
      tx.update(owner.ref, { points: FieldValue.increment(value) });
    }
    audit(tx, p.uid, "review", sid, {
      status: action,
      reason,
      points: award ? value : 0,
    });
  });
  return { ok: true };
});
exports.managerData = callable(async (req) => {
  await actor(req, true);
  const start = date(req.data?.start || D.day()),
    end = date(req.data?.end || start),
    days = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
  if (days < 1 || days > 31) fail("invalid-argument", "Select 1–31 days");
  const [tasks, rawStaff, subs] = await Promise.all([
    bounded(db.collection("tasks")),
    bounded(db.collection("staff"), 1000),
    bounded(
      db
        .collection("submissions")
        .where("date", ">=", start)
        .where("date", "<=", end),
      5000,
    ),
  ]);
  const staff = rawStaff.map((s) => ({
      ...D.publicProfile(s),
      registrationPending: s.registrationPending === true,
      id: s.id,
    })),
    f = req.data || {};
  const selected = staff.filter(
    (s) =>
      (!f.department || s.department === f.department) &&
      (!f.outlet || s.outlet === f.outlet) &&
      (!f.employee || s.id === f.employee),
  );
  const selectedIds = new Set(selected.map((s) => s.id)),
    filtered = subs.filter((s) => selectedIds.has(s.staffUid)),
    daily = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.parse(start) + i * 86400000)
      .toISOString()
      .slice(0, 10);
    daily.push({
      date: d,
      ...D.metrics(
        tasks,
        selected,
        filtered.filter((s) => s.date === d),
        d,
      ),
    });
  }
  return clean({
    tasks,
    staff,
    submissions: filtered,
    daily,
    historicalAssignments:
      "Current assignment/profile definitions; historical edits are not reconstructed.",
  });
});
exports.saveTask = callable(async (req) => {
  const p = await actor(req, true),
    d = req.data || {},
    taskId = d.id ? id(d.id) : db.collection("tasks").doc().id;
  const task = {
    title: str(d.title, 200, true),
    description: str(d.description || "", 2000),
    department: str(d.department || "", 100),
    outlet: str(d.outlet || "", 100),
    shift: str(d.shift || "", 30),
    priority: d.priority,
    assignedTo: str(d.assignedTo, 160, true),
    recurrence: d.recurrence,
    forDate: date(d.forDate),
    endDate: d.endDate ? date(d.endDate) : "",
    dueTime: str(d.dueTime || "", 5),
    requiredPhoto: d.requiredPhoto !== false,
    active: d.active !== false,
    weekdays: d.weekdays || [],
  };
  if (
    !["Normal", "High", "Critical"].includes(task.priority) ||
    !["once", "daily", "weekly"].includes(task.recurrence) ||
    !["", "Morning", "Afternoon"].includes(task.shift) ||
    (task.dueTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(task.dueTime))
  )
    fail("invalid-argument", "Invalid task settings");
  if (
    !Array.isArray(task.weekdays) ||
    task.weekdays.some((x) => !Number.isInteger(x) || x < 0 || x > 6) ||
    (task.recurrence === "weekly" && !task.weekdays.length)
  )
    fail("invalid-argument", "Choose weekdays");
  if (
    (task.assignedTo === "department" && !task.department) ||
    (task.assignedTo === "outlet" && !task.outlet)
  )
    fail("invalid-argument", "Target required");
  await db.runTransaction(async (tx) => {
    const [mgr, old] = await Promise.all([
      tx.get(db.doc("staff/" + p.uid)),
      tx.get(db.doc("tasks/" + taskId)),
    ]);
    transactionActor(mgr, true);
    if (!["all", "department", "outlet"].includes(task.assignedTo)) {
      const staff = await tx.get(db.doc("staff/" + id(task.assignedTo)));
      if (!staff.exists || staff.data().active === false)
        fail("invalid-argument", "Unknown staff UID");
    }
    tx.set(
      db.doc("tasks/" + taskId),
      {
        ...task,
        createdAt: old.data()?.createdAt || stamp(),
        updatedAt: stamp(),
      },
      { merge: true },
    );
    audit(tx, p.uid, "task.save", taskId);
  });
  return { id: taskId };
});
exports.saveStaff = callable(async (req) => {
  const p = await actor(req, true),
    d = req.data || {},
    uid = id(d.id),
    fields = {
      name: str(d.name, 200, true),
      position: str(d.position || "", 100),
      department: str(d.department || "", 100),
      outlet: str(d.outlet || "", 100),
      shift: str(d.shift || "", 30),
      active: d.active !== false,
    };
  if (!["", "Morning", "Afternoon"].includes(fields.shift))
    fail("invalid-argument", "Invalid shift");
  await db.runTransaction(async (tx) => {
    const [mgr, staff] = await Promise.all([
      tx.get(db.doc("staff/" + p.uid)),
      tx.get(db.doc("staff/" + uid)),
    ]);
    transactionActor(mgr, true);
    if (!staff.exists) fail("not-found", "Unknown staff");
    if (staff.data().role === "manager")
      fail(
        "permission-denied",
        "Manager accounts require administrator provisioning",
      );
    tx.update(staff.ref, {
      ...fields,
      ...(fields.active ? { registrationPending: false } : {}),
    });
    audit(tx, p.uid, "staff.save", uid);
  });
  return { ok: true };
});
exports.registerStaff = callable(async (req) => {
  if (!req.auth) fail("unauthenticated", "Please sign in");
  const user = await adminAuth().getUser(req.auth.uid);
  const staffID = (user.email || "").replace(/@laya\.local$/, "");
  if (
    user.email !== staffID + "@laya.local" ||
    !/^[a-z0-9_-]{1,40}$/.test(staffID)
  )
    fail("invalid-argument", "Invalid staff ID");
  const name = str(req.data?.name, 200, true);
  return db.runTransaction(async (tx) => {
    const ref = db.doc("staff/" + user.uid),
      existing = await tx.get(ref);
    if (existing.exists)
      return { existing: true, active: existing.data().active === true };
    tx.create(ref, {
      staffID,
      name,
      role: "staff",
      active: false,
      points: 0,
      position: "",
      department: "",
      outlet: "",
      shift: "",
      registrationPending: true,
      createdAt: stamp(),
    });
    audit(tx, user.uid, "staff.register", user.uid);
    return { existing: false, active: false };
  });
});
exports.resetStaffPassword = callable(async (req) => {
  const p = await actor(req, true),
    uid = id(req.data?.id);
  const password = req.data?.password;
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 128
  )
    fail("invalid-argument", "Use a password of 12–128 characters");
  const target = await db.doc("staff/" + uid).get();
  if (!target.exists || target.data().role !== "staff")
    fail("permission-denied", "Only staff passwords can be reset");
  await adminAuth().updateUser(uid, { password });
  await adminAuth().revokeRefreshTokens(uid);
  await db.collection("auditLogs").add({
    uid: p.uid,
    action: "staff.passwordReset",
    target: uid,
    at: stamp(),
  });
  return { ok: true };
});
exports.createStaff = callable(async (req) => {
  const p = await actor(req, true),
    d = req.data || {},
    staffID = str(d.staffID, 40, true).toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(staffID))
    fail("invalid-argument", "Invalid staff ID");
  const password = str(d.password, 128, true);
  if (password.length < 12)
    fail(
      "invalid-argument",
      "Use a unique password with at least 12 characters",
    );
  const fields = {
    staffID,
    name: str(d.name, 200, true),
    position: str(d.position || "", 100),
    department: str(d.department || "", 100),
    outlet: str(d.outlet || "", 100),
    shift: str(d.shift || "", 30),
    role: "staff",
    active: true,
    points: 0,
  };
  if (!["", "Morning", "Afternoon"].includes(fields.shift))
    fail("invalid-argument", "Invalid shift");
  let user;
  try {
    user = await adminAuth().createUser({
      email: staffID + "@laya.local",
      password,
    });
    await db.runTransaction(async (tx) => {
      const mgr = await tx.get(db.doc("staff/" + p.uid));
      transactionActor(mgr, true);
      tx.create(db.doc("staff/" + user.uid), { ...fields, createdAt: stamp() });
      audit(tx, p.uid, "staff.create", user.uid);
    });
  } catch (e) {
    if (user) await adminAuth().deleteUser(user.uid);
    if (e instanceof HttpsError) throw e;
    fail(
      "failed-precondition",
      "Account could not be created; check for duplicate ID",
    );
  }
  return { id: user.uid };
});
exports.checklist = callable(async (req) => {
  const p = await actor(req, true),
    d = req.data || {},
    outlet = str(d.outlet, 100, true),
    shift = str(d.shift, 30, true),
    dt = date(d.date);
  if (
    !["Morning", "Afternoon"].includes(shift) ||
    !/^[\p{L}\p{N} _-]+$/u.test(outlet)
  )
    fail("invalid-argument", "Invalid checklist");
  const ref = db.doc(
    "manager_checklists/" + `${outlet.replace(/\s+/g, "_")}_${dt}_${shift}`,
  );
  if (!d.save) {
    const s = await ref.get();
    return clean({ model: s.data() || null, version: s.data()?.revision || 0 });
  }
  const model = d.model;
  if (
    !model ||
    !Array.isArray(model.sections) ||
    model.sections.length > 30 ||
    JSON.stringify(model).length > 350000
  )
    fail("invalid-argument", "Invalid checklist data");
  for (const s of model.sections) {
    str(s.title, 300, true);
    if (!Array.isArray(s.items) || s.items.length > 100)
      fail("invalid-argument", "Invalid section");
    for (const i of s.items) {
      str(i.id, 30, true);
      str(i.text, 2000, true);
      str(i.remark || "", 2000);
      str(i.actionBy || "", 200);
      str(i.responsible || "", 200);
      if (i.photoPath) {
        const path = str(i.photoPath, 500),
          parts = path.split("/");
        if (
          parts.length !== 3 ||
          parts[0] !== "checklistEvidence" ||
          parts[1] !== ref.id ||
          !/^[a-zA-Z0-9_-]{8,100}\.jpg$/.test(parts[2])
        )
          fail("invalid-argument", "Invalid checklist evidence");
      }
      if (!["completed", "not_completed", "na"].includes(i.status))
        fail("invalid-argument", "Invalid item status");
      if (!["open", "in_progress", "closed"].includes(i.followUp || "open"))
        fail("invalid-argument", "Invalid follow up");
    }
  }
  str(model.note || "", 4000);
  str(model.checkedBy || "", 200);
  await db.runTransaction(async (tx) => {
    const [mgr, old] = await Promise.all([
      tx.get(db.doc("staff/" + p.uid)),
      tx.get(ref),
    ]);
    transactionActor(mgr, true);
    const version = old.data()?.revision || 0;
    if (d.version !== version)
      fail("aborted", "Checklist changed; reload before saving");
    const sections = model.sections.map((s) => ({
      title: s.title,
      items: s.items.map((i) => ({
        id: i.id,
        text: i.text,
        status: i.status,
        done: i.status === "completed",
        remark: i.remark || "",
        actionBy: i.actionBy || "",
        responsible: i.responsible || "",
        followUp: i.followUp || "open",
        photoPath: i.photoPath || "",
      })),
    }));
    if (old.exists) tx.create(ref.collection("history").doc(), old.data());
    tx.set(ref, {
      outlet,
      shift,
      date: dt,
      sections,
      note: model.note || "",
      checkedBy: model.checkedBy || "",
      revision: version + 1,
      managerUid: p.uid,
      managerName: p.name || "",
      createdAt: old.data()?.createdAt || stamp(),
      updatedAt: stamp(),
    });
    audit(tx, p.uid, "checklist.save", ref.id);
  });
  return { ok: true };
});
exports.uploadChecklistPhoto = callable(async (req) => {
  const p = await actor(req, true),
    d = req.data || {},
    outlet = str(d.outlet, 100, true),
    shift = str(d.shift, 30, true),
    dt = date(d.date),
    requestId = id(d.requestId);
  if (
    !["Morning", "Afternoon"].includes(shift) ||
    !/^[\p{L}\p{N} _-]+$/u.test(outlet) ||
    !/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)
  )
    fail("invalid-argument", "Invalid photo target");
  const path = `drafts/${p.uid}/${requestId}/0.jpg`,
    file = bucket().file(path);
  let safe;
  try {
    const [m] = await file.getMetadata();
    if (Number(m.size) > 2097152 || m.contentType !== "image/jpeg")
      fail("invalid-argument", "Invalid photo");
    const [bytes] = await file.download(),
      img = sharp(bytes, { limitInputPixels: 25000000 });
    if ((await img.metadata()).format !== "jpeg")
      fail("invalid-argument", "JPEG required");
    safe = await img
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    fail("invalid-argument", "Incomplete or invalid photo");
  }
  const docId = `${outlet.replace(/\s+/g, "_")}_${dt}_${shift}`,
    final = `checklistEvidence/${docId}/${requestId}.jpg`;
  await bucket()
    .file(final)
    .save(safe, {
      resumable: false,
      metadata: {
        contentType: "image/jpeg",
        cacheControl: "private, no-store",
      },
    });
  await db.runTransaction(async (tx) => {
    transactionActor(await tx.get(db.doc("staff/" + p.uid)), true);
    tx.set(db.doc("photoMetadata/" + requestId), {
      path: final,
      checklistId: docId,
      uploaderUid: p.uid,
      bytes: safe.length,
      at: stamp(),
    });
    audit(tx, p.uid, "checklist.photo", docId);
  });
  return { photoPath: final };
});
exports.cleanupEvidence = onSchedule(
  {
    schedule: "0 2 * * *",
    timeZone: "Asia/Bangkok",
    timeoutSeconds: 540,
    memory: "256MiB",
    maxInstances: 1,
    retryCount: 3,
    minBackoffSeconds: 60,
    maxBackoffSeconds: 600,
  },
  async () => {
    const dryRun = process.env.CLEANUP_MODE !== "delete";
    if (!dryRun) {
      if (
        process.env.RETENTION_BUCKET_REVIEWED !== "true" ||
        !process.env.EVIDENCE_BUCKET
      )
        throw Error("Reviewed dedicated evidence bucket required");
      const [meta] = await bucket().getMetadata();
      R.assertBucketPolicy(meta);
    }
    const result = await R.runCleanup({
      db,
      bucket: bucket(),
      dryRun,
      log: (entry) => logger.info(entry),
    });
    if (!result.complete && !result.locked)
      throw Error("Cleanup scan incomplete; retry resumes cursor");
  },
);
exports.evidenceStatus = callable(async (req) => {
  const p = await actor(req),
    paths = req.data?.paths;
  if (!Array.isArray(paths) || paths.length > 10)
    fail("invalid-argument", "Maximum ten evidence paths");
  for (const path of paths) {
    str(path, 500, true);
    const kind = R.classify(path);
    const legacy =
      /^submissions\/\d{4}-\d{2}-\d{2}\/([A-Za-z0-9_.-]+)\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.exec(
        path,
      );
    if (!kind && !legacy) fail("permission-denied", "Invalid evidence path");
    const owner = kind?.owner || legacy?.[1];
    if (p.role !== "manager" && (kind?.kind === "checklist" || owner !== p.uid))
      fail("permission-denied", "Evidence owner mismatch");
  }
  return Promise.all(
    paths.map((path) => R.evidenceStatus({ db, bucket: bucket(), path })),
  );
});
