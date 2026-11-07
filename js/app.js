import {
  icon,
  ring,
  kpis,
  enhance,
  setupShell,
  analytics,
  searchList,
  ask,
} from "./ui.js";
import {
  api,
  auth,
  ready,
  currentUser,
  login,
  register,
  logout,
  photoBlob,
  upload,
} from "./firebase-init.js";
import { BASE_SECTIONS_V1, TASK_TITLE_LIBRARY } from "./templates.js";
const $ = (id) => document.getElementById(id),
  page = document.body.dataset.page;
let lang = localStorage.getItem("laya.language") || "th",
  busy = false,
  profile,
  historyCursor = null,
  manager,
  subPage = 0;
const t = (th, en) => (lang === "th" ? th : en);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const formValues = (f) => Object.fromEntries(new FormData(f));
function message(s) {
  if ($("message")) $("message").textContent = s;
}
function toast(s) {
  document.querySelectorAll(".toast").forEach((old) => old.remove());
  const el = document.createElement("div");
  el.className = "toast";
  el.role = "status";
  el.textContent = s;
  document.body.append(el);
  setTimeout(() => el.remove(), 4500);
}
function error(e) {
  console.error(e);
  const messages = {
    "functions/permission-denied": t(
      "ไม่มีสิทธิ์ดำเนินการนี้",
      "Access denied",
    ),
    "functions/resource-exhausted": t(
      "ส่งครบโควตา หรือข้อมูลมากเกินไป กรุณาลดช่วงวันที่",
      "Daily quota reached or too much data; narrow date range",
    ),
    "functions/already-exists": t(
      "งานนี้ส่งแล้ว กรุณาให้ผู้จัดการเปิดงานที่ถูกปฏิเสธก่อนส่งแก้ไข",
      "Already submitted; ask a manager to reopen rejected work",
    ),
    "functions/aborted": t(
      "รายการตรวจถูกแก้ไขจากที่อื่น โปรดคัดลอกบันทึกแล้วโหลดใหม่",
      "Checklist changed elsewhere. Copy your notes and reload.",
    ),
    "auth/invalid-credential": t(
      "รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง",
      "Invalid staff ID or password",
    ),
  };
  message(
    messages[e.code] ||
      `${t("ดำเนินการไม่สำเร็จ", "Action failed")}: ${e.message}`,
  );
}
async function run(fn) {
  if (busy) return;
  busy = true;
  document.body.dataset.busy = "true";
  if ($("logout")) $("logout").disabled = true;
  message("");
  try {
    await fn();
  } catch (e) {
    error(e);
  } finally {
    busy = false;
    document.body.dataset.busy = "false";
    if ($("logout")) $("logout").disabled = false;
  }
}
function translate() {
  document.documentElement.lang = lang;
  document
    .querySelectorAll("[data-th]")
    .forEach((el) => (el.textContent = el.dataset[lang]));
  if ($("language")) $("language").textContent = lang === "th" ? "EN" : "ไทย";
}
$("language")?.addEventListener("click", () => {
  lang = lang === "th" ? "en" : "th";
  localStorage.setItem("laya.language", lang);
  translate();
  if (page === "staff" && staffData) renderStaff(staffData);
  if (page === "manager" && manager) renderManager();
});
translate();
function connection() {
  if ($("connection")) {
    $("connection").className = navigator.onLine ? "online" : "offline";
    $("connection").textContent = navigator.onLine
      ? t("● เชื่อมต่อเครือข่าย", "● Network available")
      : t(
          "○ ออฟไลน์ — ยังไม่บันทึกบน server",
          "○ Offline — not saved to server",
        );
  }
}
window.addEventListener("online", connection);
window.addEventListener("offline", connection);
connection();
$("logout")?.addEventListener("click", () =>
  run(async () => {
    await clearDrafts();
    await logout();
  }),
);
const status = (s) =>
  ({
    waiting: t("รอตรวจ", "Pending review"),
    approved: t("อนุมัติแล้ว", "Approved"),
    rejected: t("ต้องแก้ไข", "Rejected"),
    reopened: t("เปิดให้ส่งแก้ไข", "Reopened"),
  })[s] || t("ยังไม่ส่ง", "Not submitted");
const badge = (s) =>
  `<span class="badge ${["waiting", "approved", "rejected", "reopened", "overdue"].includes(s) ? s : ""}">${esc(status(s))}</span>`;
function stats(items) {
  $("stats").innerHTML = kpis(items);
}
function listen(id, event, fn) {
  $(id)?.addEventListener(event, (e) => {
    e.preventDefault();
    run(() => fn(e));
  });
}
const objectUrls = [];
async function gallery(s) {
  $("galleryImages").replaceChildren();
  $("gallery").showModal();
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls.length = 0;
  const paths = s.photoPaths?.length
    ? s.photoPaths
    : s.photoPath
      ? [s.photoPath]
      : [];
  if (!paths.length) {
    $("galleryImages").textContent = t(
      "ไม่มีเส้นทางรูปที่เปิดอย่างปลอดภัยได้",
      "No secure photo path available",
    );
    return;
  }
  for (const path of paths) {
    const box = document.createElement("div");
    box.textContent = t("กำลังโหลดหลักฐาน…", "Loading evidence…");
    $("galleryImages").append(box);
    try {
      const [retention] = await api("evidenceStatus", { paths: [path] });
      if (retention.state === "expired") {
        box.className = "notice";
        box.textContent = t(
          "รูปหลักฐานหมดอายุและถูกลบอัตโนมัติหลัง 7 วัน",
          "Evidence expired and was automatically deleted after 7 days",
        );
        continue;
      }
      if (retention.state === "missing") {
        box.textContent = t(
          "ไม่พบรูปหลักฐาน กรุณาติดต่อผู้ดูแล",
          "Evidence not found. Contact your administrator.",
        );
        continue;
      }
      const blob = await photoBlob(path),
        url = URL.createObjectURL(blob);
      objectUrls.push(url);
      const img = new Image();
      img.src = url;
      img.alt = t("หลักฐานการทำงาน", "Work evidence");
      box.replaceChildren(img);
    } catch {
      box.textContent = t(
        "ไม่สามารถเปิดรูปได้ หรือไม่มีสิทธิ์",
        "Photo unavailable or access denied",
      );
    }
  }
}
$("closeGallery")?.addEventListener("click", () => $("gallery").close());
function dbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("laya-v4-drafts", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("drafts");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function draftOp(key, value, remove = false) {
  const db = await dbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction(
        "drafts",
        value !== undefined || remove ? "readwrite" : "readonly",
      ),
      store = tx.objectStore("drafts");
    const r = remove
      ? store.delete(key)
      : value === undefined
        ? store.get(key)
        : store.put(value, key);
    tx.oncomplete = () => {
      db.close();
      res(r.result);
    };
    tx.onerror = () => {
      db.close();
      rej(tx.error);
    };
  });
}
async function clearDrafts() {
  const db = await dbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction("drafts", "readwrite");
    tx.objectStore("drafts").clear();
    tx.oncomplete = () => {
      db.close();
      res();
    };
    tx.onerror = () => rej(tx.error);
  });
}
let staffData;
async function loadStaff() {
  const key = "dashboard:" + profile.uid;
  try {
    staffData = await api("dashboard");
    sessionStorage.setItem(key, JSON.stringify(staffData));
  } catch (e) {
    const cached = sessionStorage.getItem(key);
    if (!cached) throw e;
    staffData = JSON.parse(cached);
    message(
      t(
        "แสดงข้อมูลที่ดูครั้งล่าสุด — อาจไม่ใช่สถานะปัจจุบัน",
        "Showing last viewed data — may be out of date",
      ),
    );
  }
  renderStaff(staffData);
}
function renderStaff(d) {
  let progress = $("staffProgress");
  if (!progress) {
    progress = document.createElement("div");
    progress.id = "staffProgress";
    progress.className = "staff-progress";
    $("stats").before(progress);
  }
  const done = d.submissions.filter((s) => s.status === "approved").length;
  progress.innerHTML =
    ring(done, d.tasks.length, t("งานวันนี้", "Today")) +
    "<div><b>" +
    t("ทุกงานสำคัญ ทุกวันของคุณ", "Every task makes a difference") +
    "</b><p>" +
    esc([d.profile.outlet, d.profile.shift].filter(Boolean).join(" · ")) +
    "</p><p>" +
    done +
    "/" +
    d.tasks.length +
    " " +
    t("งานอนุมัติแล้ว", "tasks approved") +
    "</p></div>";
  const approved = d.submissions.filter((s) => s.status === "approved").length;
  if (sessionStorage.getItem("laya.submitted")) {
    sessionStorage.removeItem("laya.submitted");
    toast(
      t(
        "ส่งงานสำเร็จแล้ว · รอผู้จัดการตรวจ",
        "Submission received · Awaiting review",
      ),
    );
  }
  const overdue = d.tasks.filter(
    (task) =>
      task.dueTime &&
      new Date(d.date + "T" + task.dueTime + ":00+07:00") < new Date() &&
      !d.submissions.some(
        (s) => s.taskId === task.id && s.status === "approved",
      ),
  ).length;
  stats([
    [t("งานวันนี้", "Assigned today"), d.tasks.length, d.date],
    [
      t("ยังไม่อนุมัติ", "Remaining"),
      d.tasks.length - approved,
      t("รวมงานที่รอตรวจ", "Includes pending review"),
    ],
    [
      t("อนุมัติแล้ว", "Completed"),
      approved,
      t("ผู้จัดการยืนยันแล้ว", "Manager confirmed"),
    ],
    [
      t("เกินกำหนด", "Overdue"),
      overdue,
      t("ยังไม่อนุมัติหลังเวลาครบกำหนด", "Not approved after due time"),
    ],
  ]);
  $("quota").textContent = t(
    `ส่งแล้ว ${d.submissions.length}/2 งานวันนี้ · คะแนนสะสม ${d.profile.points || 0}`,
    `Submitted ${d.submissions.length}/2 today · ${d.profile.points || 0} points`,
  );
  $("achievement").textContent = t(
    `คะแนนสะสม ${d.profile.points || 0} · ${d.profile.points >= 50 ? "ยอดเยี่ยม" : d.profile.points >= 10 ? "ทำได้ดี" : "เริ่มสะสมความสำเร็จของคุณ"}`,
    `${d.profile.points || 0} points · ${d.profile.points >= 50 ? "Excellent service" : d.profile.points >= 10 ? "Great progress" : "Build your achievements"}`,
  );
  $("tasks").innerHTML = d.tasks.length
    ? d.tasks
        .map((task) => {
          const s = d.submissions.find((s) => s.taskId === task.id),
            allowed =
              (!s && d.submissions.length < 2) || s?.status === "reopened";
          return `<article class="task"><div class="task-icon">✓</div><div><h3>${esc(task.title)}</h3><p class="small">${esc(task.description)}</p><div class="row"><span class="priority">${esc(task.priority || "Normal")}</span><span class="small">${esc(task.outlet || task.department)} · ${esc(task.dueTime || "—")}</span>${badge(s?.status)}</div>${s?.rejectionReason ? `<p class="notice">${esc(s.rejectionReason)}</p>` : ""}</div><div class="task-action">${allowed ? `<a class="button" href="upload.html?taskId=${encodeURIComponent(task.id)}">${s ? t("ส่งแก้ไข", "Resubmit") : t("ส่งงาน", "Submit")}</a>` : `<span class="small">${s ? t("ดูผลในประวัติ", "See work history") : t("ครบโควตาวันนี้", "Daily limit reached")}</span>`}</div></article>`;
        })
        .join("")
    : `<div class="empty">${t("ไม่มีงานที่ได้รับมอบหมายวันนี้", "No assignments for today")}</div>`;
  translate();
}
async function loadHistory(append = false) {
  const data = await api("history", { cursor: append ? historyCursor : null });
  historyCursor = data.cursor;
  if (!append) $("history").replaceChildren();
  if (!data.rows.length && !append)
    $("history").innerHTML =
      `<div class="empty">${t("ยังไม่มีประวัติ", "No history yet")}</div>`;
  for (const s of data.rows) {
    const el = document.createElement("article");
    el.className = "task";
    el.innerHTML = `<div class="task-icon">↗</div><div><h3>${esc(s.taskTitle || s.taskId)}</h3><div class="small">${esc(s.date)} · ${Number(s.photosCount) || 0} ${t("รูป", "photos")}</div>${badge(s.status)}${s.rejectionReason ? `<p class="notice">${esc(s.rejectionReason)}</p>` : ""}</div><button class="secondary">${t("ดูรูป", "Photos")}</button>`;
    el.querySelector("button").addEventListener("click", () =>
      run(() => gallery(s)),
    );
    $("history").append(el);
  }
  $("moreHistory").hidden = !historyCursor;
}
async function compress(file) {
  if (
    file.size > 20 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  )
    throw Error(
      t(
        "รองรับ JPEG/PNG/WebP ไม่เกิน 20 MB ต่อรูป",
        "Use JPEG/PNG/WebP up to 20 MB per photo",
      ),
    );
  const image = await createImageBitmap(file);
  try {
    if (image.width * image.height > 25000000)
      throw Error("Image too large (25 megapixels max)");
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height)),
      canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    let blob;
    for (let q = 0.85; q >= 0.45; q -= 0.1) {
      blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", q));
      if (blob && blob.size <= 2 * 1024 * 1024) return blob;
    }
    throw Error("Unable to compress under 2 MB");
  } finally {
    image.close();
  }
}
let draft,
  draftKey,
  uploadTask,
  draftWriting = Promise.resolve();
function saveDraft() {
  draftWriting = draftWriting
    .catch(() => {})
    .then(() => draftOp(draftKey, draft));
  return draftWriting;
}
function draftStatus() {
  const date = draft?.date;
  $("draftStatus").textContent = t(
    `แบบร่างเก็บในอุปกรณ์ · ${draft?.blobs?.length || 0} รูป · ${date} · ยังไม่ได้ส่ง`,
    `Draft saved on device · ${draft?.blobs?.length || 0} photos · ${date} · Not submitted`,
  );
}
function previews() {
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls.length = 0;
  $("previews").replaceChildren();
  for (const [index, blob] of draft.blobs.entries()) {
    const img = new Image(),
      url = URL.createObjectURL(blob);
    objectUrls.push(url);
    img.src = url;
    img.className = "thumb";
    img.alt = "Draft evidence";
    const tile = document.createElement("div");
    tile.className = "photo-tile";
    tile.append(img);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute(
      "aria-label",
      t("ลบรูป", "Remove photo") + " " + (index + 1),
    );
    remove.disabled = draft.paths.length > 0;
    remove.addEventListener("click", () =>
      run(async () => {
        draft.blobs.splice(index, 1);
        await saveDraft();
        previews();
      }),
    );
    tile.append(remove);
    $("previews").append(tile);
  }
  draftStatus();
}
async function loadUpload() {
  const taskId = new URLSearchParams(location.search).get("taskId");
  if (!taskId) throw Error("Missing task ID");
  draftKey = profile.uid + ":" + taskId;
  const cached = await draftOp(draftKey);
  let d;
  try {
    d = await api("dashboard");
    sessionStorage.setItem("dashboard:" + profile.uid, JSON.stringify(d));
  } catch (e) {
    d = JSON.parse(
      sessionStorage.getItem("dashboard:" + profile.uid) || "null",
    );
    if (!d) throw e;
    message(
      t(
        "ออฟไลน์ — เตรียมแบบร่างได้ แต่ยังส่งไม่ได้",
        "Offline — prepare a draft; submission unavailable",
      ),
    );
  }
  uploadTask = d.tasks.find((t) => t.id === taskId);
  if (!uploadTask)
    throw Error(
      t("ไม่พบงานที่ได้รับมอบหมายวันนี้", "Task is not assigned today"),
    );
  const sub = d.submissions.find((s) => s.taskId === taskId);
  $("taskTitle").textContent = uploadTask.title;
  $("taskDescription").textContent = uploadTask.description;
  $("taskDetails").textContent =
    `${uploadTask.outlet || uploadTask.department || ""} · ${uploadTask.priority || "Normal"} · ${uploadTask.dueTime || ""}`;
  $("rejection").textContent = sub?.rejectionReason || "";
  draft = cached || {
    requestId: crypto.randomUUID(),
    taskId,
    date: today(),
    note: "",
    blobs: [],
    paths: [],
  };
  $("note").value = draft.note;
  previews();
  if (draft.date !== today())
    message(
      t(
        "แบบร่างจากวันก่อน โปรดตรวจเนื้อหาและล้างแบบร่างก่อนส่งวันใหม่",
        "Draft is from a previous day. Review and discard before submitting for a new day.",
      ),
    );
  $("note").addEventListener("input", () => {
    draft.note = $("note").value;
    saveDraft().then(draftStatus).catch(error);
  });
  listen("photo", "change", async () => {
    const files = [...$("photo").files];
    if (files.length > 10) throw Error("Maximum 10 photos");
    if (draft.paths.length)
      throw Error(
        t(
          "อัปโหลดบางส่วนแล้ว หากต้องเปลี่ยนรูป ให้ล้างแบบร่างก่อน",
          "Some photos uploaded. Discard the draft before replacing photos.",
        ),
      );
    $("submitWork").disabled = true;
    try {
      const blobs = [];
      for (let i = 0; i < files.length; i++) {
        $("draftStatus").textContent = t(
          `กำลังเตรียมรูป ${i + 1}/${files.length}`,
          `Preparing photo ${i + 1}/${files.length}`,
        );
        blobs.push(await compress(files[i]));
      }
      draft.blobs = blobs;
      await saveDraft();
      previews();
    } finally {
      $("submitWork").disabled = false;
    }
  });
  listen("discardDraft", "click", async () => {
    if (
      !(await ask(
        t(
          "ล้างรูปและบันทึกในแบบร่างนี้?",
          "Discard this draft and its photos?",
        ),
      ))
    )
      return;
    await draftOp(draftKey, undefined, true);
    location.reload();
  });
  listen("uploadForm", "submit", async () => {
    if (!navigator.onLine)
      throw Error(
        t(
          "ออฟไลน์ แบบร่างยังอยู่ในอุปกรณ์",
          "Offline. Your draft is still on this device",
        ),
      );
    if (draft.date !== today())
      throw Error("Draft date differs; discard old draft first");
    if (uploadTask.requiredPhoto !== false && !draft.blobs.length)
      throw Error(t("กรุณาเพิ่มรูปก่อน", "Add a photo first"));
    $("submitWork").disabled = true;
    try {
      draft.note = $("note").value;
      await saveDraft();
      for (let i = 0; i < draft.blobs.length; i++) {
        const path = `drafts/${profile.uid}/${draft.requestId}/${i}.jpg`;
        $("draftStatus").textContent = t(
          `กำลังอัปโหลดรูป ${i + 1}/${draft.blobs.length}`,
          `Uploading photo ${i + 1}/${draft.blobs.length}`,
        );
        await upload(
          path,
          draft.blobs[i],
          (n) =>
            ($("progress").value = Math.round(
              (i * 100 + n) / draft.blobs.length,
            )),
        );
        draft.paths[i] = path;
        await saveDraft();
      }
      $("draftStatus").textContent = t(
        "กำลังรอ server ยืนยัน…",
        "Waiting for server confirmation…",
      );
      const result = await api("submitWork", {
        taskId: draft.taskId,
        requestId: draft.requestId,
        photoPaths: draft.paths,
        note: draft.note,
      });
      if (!result.id) throw Error("Server did not confirm");
      await draftOp(draftKey, undefined, true);
      sessionStorage.removeItem("dashboard:" + profile.uid);
      sessionStorage.setItem("laya.submitted", "1");
      busy = false;
      location.href = "staff.html";
    } catch (e) {
      draftStatus();
      throw e;
    } finally {
      $("submitWork").disabled = false;
    }
  });
}
function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function selectOptions(el, items, first) {
  const old = el.value;
  el.replaceChildren();
  for (const [value, label] of [...first, ...items]) {
    const o = new Option(label, value);
    el.add(o);
  }
  el.value = old;
}
async function loadManager() {
  const f = formValues($("filterForm"));
  manager = await api("managerData", f);
  subPage = 0;
  renderManager();
}
function renderManager() {
  const totals = manager.daily.reduce((a, d) => {
    for (const k of ["assigned", "approved", "waiting", "overdue", "rejected"])
      a[k] = (a[k] || 0) + d[k];
    return a;
  }, {});
  stats([
    [
      t("อัตราสำเร็จ", "Completion rate"),
      totals.assigned
        ? `${Math.round((totals.approved / totals.assigned) * 100)}%`
        : "—",
      `${totals.approved}/${totals.assigned} ${t("งานรายคน", "staff-task-days")}`,
    ],
    [t("รอผู้จัดการตรวจ", "Pending review"), totals.waiting],
    [t("อนุมัติแล้ว", "Approved"), totals.approved],
    [t("เกินกำหนด", "Overdue"), totals.overdue],
  ]);
  selectOptions(
    $("employeeFilter"),
    manager.staff.map((p) => [p.id, `${p.name} (${p.staffID})`]),
    [["", t("ทุกคน", "All employees")]],
  );
  selectOptions(
    $("assignee"),
    manager.staff
      .filter((p) => p.active !== false)
      .map((p) => [p.id, `${p.name} (${p.staffID})`]),
    [
      ["all", t("ทุกคน", "All staff")],
      ["department", t("แผนก", "Department")],
      ["outlet", t("จุดบริการ", "Outlet")],
    ],
  );
  renderSubmissions();
  const daily = manager.daily.map((d) => [
    esc(d.date),
    d.assigned,
    d.approved,
    d.waiting,
    d.rejected,
    d.overdue,
    d.assigned ? `${((d.approved / d.assigned) * 100).toFixed(1)}%` : "—",
  ]);
  $("report").innerHTML = table(
    [
      t("วันที่", "Day"),
      t("มอบหมาย", "Assigned"),
      t("อนุมัติ", "Approved"),
      t("รอตรวจ", "Pending"),
      t("ปฏิเสธ", "Rejected"),
      t("เกินกำหนด", "Overdue"),
      t("สำเร็จ", "Completion"),
    ],
    daily,
  );
  const byStaff = new Map();
  for (const day of manager.daily)
    for (const row of day.rows) {
      const prior = byStaff.get(row.id) || {
        ...row,
        assigned: 0,
        submitted: 0,
        approved: 0,
        missing: 0,
        overdue: 0,
      };
      for (const k of [
        "assigned",
        "submitted",
        "approved",
        "missing",
        "overdue",
      ])
        prior[k] += row[k];
      byStaff.set(row.id, prior);
    }
  $("report").innerHTML +=
    `<h3 class="section-gap">${t("ติดตามงานรายพนักงาน", "Employee performance")}</h3>` +
    table(
      [
        t("ชื่อ", "Name"),
        t("แผนก / จุดบริการ", "Department / Outlet"),
        t("ส่ง / มอบหมาย", "Submitted / Assigned"),
        t("อนุมัติ", "Approved"),
        t("ยังไม่ส่ง / ต้องแก้ไข", "Missing / Rejected"),
        t("เกินกำหนด", "Overdue"),
      ],
      [...byStaff.values()].map((r) => [
        esc(r.name),
        esc(`${r.department} / ${r.outlet}`),
        `${r.submitted}/${r.assigned}`,
        r.approved,
        r.missing,
        r.overdue,
      ]),
    );
  $("taskList").replaceChildren();
  for (const task of manager.tasks) {
    const el = document.createElement("article");
    el.className = "task";
    el.innerHTML = `<div class="task-icon">☷</div><div><h3>${esc(task.title)}</h3><div class="small">${esc(task.recurrence || (task.forDate ? "once" : "daily"))} · ${esc(task.forDate || "")} · ${esc(task.priority)} · ${task.active ? t("เปิด", "Active") : t("ปิด", "Inactive")}</div></div><button class="secondary">${t("แก้ไข", "Edit")}</button>`;
    el.querySelector("button").addEventListener("click", () => {
      fillForm($("taskForm"), {
        ...task,
        recurrence: task.recurrence || (task.forDate ? "once" : "daily"),
        forDate: task.forDate || today(),
        weekdays: (task.weekdays || []).join(","),
      });
      $("taskForm").scrollIntoView({ behavior: "smooth" });
    });
    $("taskList").append(el);
  }
  $("staffList").replaceChildren();
  for (const p of [...manager.staff].sort(
    (a, b) => (b.points || 0) - (a.points || 0),
  )) {
    const el = document.createElement("article");
    el.className = "task";
    el.innerHTML = `<div class="task-icon">${Number(p.points) || 0}</div><div><h3>${esc(p.name)}</h3><div class="small">${esc(p.staffID)} · ${esc(p.department)} · ${esc(p.outlet)} · ${esc(p.shift)} ${p.active === false ? (p.registrationPending ? t("รอเปิดสิทธิ์", "Awaiting activation") : t("ปิดสิทธิ์", "Inactive")) : t("เปิดสิทธิ์แล้ว", "Active")}</div></div>${p.role !== "manager" ? `<button class="secondary">${t("แก้ไข", "Edit")}</button>` : ""}`;
    el.querySelector("button")?.addEventListener("click", () => {
      fillForm($("staffForm"), p);
      $("staffForm").elements.staffID.disabled = true;
      $("staffForm").elements.password.disabled = false;
      $("resetStaffPassword").hidden = false;
      $("staffForm").scrollIntoView({ behavior: "smooth" });
    });
    $("staffList").append(el);
  }
  analytics(manager, t);
  searchList("taskList", t);
  searchList("staffList", t);
  enhance();
  translate();
}
function fillForm(f, data) {
  f.dataset.filling = "true";
  f.reset();
  f.dataset.filling = "false";
  for (const [key, value] of Object.entries(data)) {
    const el = f.elements.namedItem(key);
    if (!el) continue;
    if (el.type === "checkbox") el.checked = value !== false;
    else el.value = value ?? "";
  }
}
function renderSubmissions() {
  const list = manager.submissions
      .filter((s) => $("showApproved").checked || s.status !== "approved")
      .sort((a, b) => b.date.localeCompare(a.date)),
    slice = list.slice(subPage * 15, subPage * 15 + 15);
  $("submissions").replaceChildren();
  if (!slice.length)
    $("submissions").innerHTML =
      `<div class="empty">${t("ไม่มีงานรอตรวจในช่วงที่เลือก", "No work awaiting review in this period")}</div>`;
  for (const s of slice) {
    const el = document.createElement("article");
    el.className = "task";
    el.innerHTML = `<div class="task-icon">▧</div><div><h3>${esc(s.taskTitle || s.taskId)}</h3><div class="small">${esc(s.staffName)} · ${esc(s.department)} · ${esc(s.outlet)} · ${esc(s.date)}</div><p>${esc(s.note)}</p>${badge(s.status)}${s.rejectionReason ? `<p class="notice">${esc(s.rejectionReason)}</p>` : ""}</div><div class="actions"><button data-action="photo" class="secondary">${t("ดูรูป", "Photos")}</button>${s.status === "waiting" ? `<button data-action="approved" class="success">${t("อนุมัติ", "Approve")}</button><button data-action="rejected" class="danger">${t("ให้แก้ไข", "Reject")}</button>` : ""}${s.status === "rejected" && s.date === today() ? `<button data-action="reopened" class="secondary">${t("เปิดให้ส่งแก้ไข", "Reopen")}</button>` : ""}</div>`;
    el.querySelectorAll("button").forEach((btn) =>
      btn.addEventListener("click", () =>
        run(async () => {
          if (btn.dataset.action === "photo") return gallery(s);
          let reason = "";
          if (
            btn.dataset.action === "approved" &&
            !(await ask(t("ยืนยันอนุมัติงานนี้?", "Approve this submission?"), {
              detail: `${s.taskTitle || s.taskId} · ${s.staffName}`,
              confirmLabel: t("ยืนยันอนุมัติ", "Approve submission"),
            }))
          )
            return;
          if (btn.dataset.action === "rejected") {
            reason = await ask(
              t("ระบุเหตุผลและแนวทางแก้ไข", "Reason and resubmission guidance"),
              {
                text: true,
                detail: `${s.taskTitle || s.taskId} · ${s.staffName}`,
                confirmLabel: t("ส่งกลับให้แก้ไข", "Send back for correction"),
              },
            );
            if (!reason) return;
          }
          btn.disabled = true;
          try {
            await api("reviewSubmission", {
              id: s.id,
              status: btn.dataset.action,
              reason,
            });
            await loadManager();
            toast(t("บันทึกผลการตรวจแล้ว", "Review saved"));
          } finally {
            btn.disabled = false;
          }
        }),
      ),
    );
    $("submissions").append(el);
    if (s.status === "waiting") {
      const paths = s.photoPaths?.length
        ? s.photoPaths
        : s.photoPath
          ? [s.photoPath]
          : [];
      if (paths.length)
        api("evidenceStatus", { paths: paths.slice(0, 10) })
          .then((states) => {
            if (!el.isConnected) return;
            const expired = states.some((x) => x.state === "expired"),
              soon = states.some((x) => x.approaching);
            if (expired || soon) {
              const warning = document.createElement("p");
              warning.className = "notice";
              warning.setAttribute("role", "status");
              warning.textContent = expired
                ? t(
                    "รูปหลักฐานหมดอายุและถูกลบอัตโนมัติหลัง 7 วัน",
                    "Evidence expired and was automatically deleted after 7 days",
                  )
                : t(
                    "หลักฐานใกล้ครบ 7 วัน — โปรดดูรูปและตรวจงานก่อนรูปถูกลบอัตโนมัติ",
                    "Evidence expires within 24 hours or is awaiting cleanup — review now",
                  );
              el.children[1].append(warning);
            }
          })
          .catch(() => {});
    }
  }
  $("pageLabel").textContent =
    `${subPage + 1} / ${Math.max(1, Math.ceil(list.length / 15))}`;
  $("prevSub").disabled = subPage === 0;
  $("nextSub").disabled = (subPage + 1) * 15 >= list.length;
}
function csvCell(value) {
  let s = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
function exportReport() {
  const rows = [
    [
      "date",
      "staff",
      "department",
      "outlet",
      "assigned",
      "submitted",
      "approved",
      "missing",
      "overdue",
      "completion_rate",
      "basis",
    ],
    ...manager.daily.flatMap((d) =>
      d.rows.map((r) => [
        d.date,
        r.name,
        r.department,
        r.outlet,
        r.assigned,
        r.submitted,
        r.approved,
        r.missing,
        r.overdue,
        r.assigned ? (r.approved / r.assigned).toFixed(4) : "",
        manager.historicalAssignments,
      ]),
    ),
  ];
  const blob = new Blob(
      ["\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "laya-performance.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function setupManager() {
  const f = $("filterForm");
  f.elements.start.value = today();
  f.elements.end.value = today();
  $("taskForm").elements.forDate.value = today();
  $("template").innerHTML += [...TASK_TITLE_LIBRARY]
    .map((x) => `<option value="${esc(x)}">${esc(x)}</option>`)
    .join("");
  $("template").addEventListener(
    "change",
    () => ($("taskForm").elements.title.value = $("template").value),
  );
  listen("filterForm", "submit", loadManager);
  $("showApproved").addEventListener("change", () => {
    subPage = 0;
    renderSubmissions();
  });
  $("prevSub").addEventListener("click", () => {
    subPage--;
    renderSubmissions();
  });
  $("nextSub").addEventListener("click", () => {
    subPage++;
    renderSubmissions();
  });
  $("export").addEventListener("click", exportReport);
  $("print").addEventListener("click", () => window.print());
  document.querySelectorAll("[data-tab]").forEach((btn) =>
    btn.addEventListener("click", () => {
      document
        .querySelectorAll("[data-tab]")
        .forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
      document
        .querySelectorAll(".panel")
        .forEach((p) => (p.hidden = p.id !== btn.dataset.tab));
    }),
  );
  listen("taskForm", "submit", async () => {
    const f = $("taskForm"),
      v = formValues(f);
    v.active = f.elements.active.checked;
    v.requiredPhoto = f.elements.requiredPhoto.checked;
    v.weekdays = v.weekdays.trim() ? v.weekdays.split(",").map(Number) : [];
    await api("saveTask", v);
    f.reset();
    f.elements.forDate.value = today();
    await loadManager();
    toast(t("บันทึกงานแล้ว", "Task saved"));
  });
  listen("staffForm", "submit", async () => {
    const f = $("staffForm"),
      v = formValues(f);
    v.active = f.elements.active.checked;
    await api(v.id ? "saveStaff" : "createStaff", v);
    f.reset();
    await loadManager();
    toast(t("บันทึกพนักงานแล้ว", "Staff saved"));
  });
  listen("resetStaffPassword", "click", async () => {
    const f = $("staffForm");
    if (!f.elements.id.value) return;
    if (f.elements.password.value.length < 12)
      throw Error(
        t("กรอกรหัสผ่านใหม่อย่างน้อย 12 ตัว", "Enter at least 12 characters"),
      );
    if (
      !(await ask(
        t(
          "ตั้งรหัสผ่านใหม่ให้พนักงานคนนี้? โปรดแจ้งรหัสผ่านผ่านช่องทางส่วนตัว",
          "Reset this staff password? Share it privately.",
        ),
      ))
    )
      return;
    await api("resetStaffPassword", {
      id: f.elements.id.value,
      password: f.elements.password.value,
    });
    f.elements.password.value = "";
    toast(t("ตั้งรหัสผ่านใหม่แล้ว", "Password reset"));
  });
  $("staffForm").addEventListener("reset", () => {
    if ($("staffForm").dataset.filling === "true") return;
    setTimeout(() => {
      $("staffForm").elements.id.value = "";
      $("resetStaffPassword").hidden = true;
      $("staffForm").elements.staffID.disabled = false;
      $("staffForm").elements.password.disabled = false;
    }, 0);
  });
  $("taskForm").addEventListener("reset", () => {
    if ($("taskForm").dataset.filling === "true") return;
    setTimeout(() => {
      $("taskForm").elements.id.value = "";
      $("taskForm").elements.forDate.value = today();
    }, 0);
  });
  await loadManager();
}
let checklistModel,
  checklistVersion = 0,
  checklistSelection,
  checkDirty = false;
function itemStatus(item) {
  return item.status || (item.done ? "completed" : "not_completed");
}
function renderChecklist() {
  const root = $("checkItems");
  root.replaceChildren();
  let jump = $("checkJump");
  if (!jump) {
    const label = document.createElement("label");
    label.className = "check-jump";
    label.textContent = t("ไปยังหมวดตรวจ", "Jump to category");
    jump = document.createElement("select");
    jump.id = "checkJump";
    label.append(jump);
    $("checklistFilter").closest(".card").before(label);
    jump.addEventListener("change", () => {
      const card = root.children[Number(jump.value)];
      if (card) {
        card.open = true;
        card.scrollIntoView({ block: "start", behavior: "instant" });
        card.querySelector("summary").focus();
      }
    });
  }
  jump.replaceChildren(
    ...checklistModel.sections.map((s, i) => new Option(s.title, String(i))),
  );
  for (const section of checklistModel.sections) {
    const card = document.createElement("details");
    card.open = root.children.length === 0;
    card.className = "card section-gap check-category";
    const h = document.createElement("summary");
    h.innerHTML = icon("check");
    const categoryTitle = document.createElement("span");
    categoryTitle.textContent = section.title;
    h.append(categoryTitle);
    const count = document.createElement("span");
    count.className = "category-count";
    count.textContent = section.items.length + " " + t("รายการ", "items");
    h.append(count);
    card.append(h);
    for (const item of section.items) {
      item.status = itemStatus(item);
      const el = document.createElement("div");
      el.className = "check-item";
      el.dataset.status = item.status;
      const title = document.createElement("b");
      title.textContent = item.id + " · " + item.text;
      el.append(title);
      const fields = document.createElement("div");
      fields.className = "check-fields";
      const defs = [
        [
          "status",
          t("สถานะ", "Status"),
          "select",
          [
            ["not_completed", t("ยังไม่เสร็จ", "Not completed")],
            ["completed", t("เสร็จแล้ว", "Completed")],
            ["na", "N/A"],
          ],
        ],
        [
          "remark",
          t("บันทึก / หลักฐานอ้างอิง", "Note / evidence reference"),
          "text",
        ],
        [
          "responsible",
          t("พนักงานผู้รับผิดชอบ", "Responsible employee"),
          "text",
        ],
        ["actionBy", "Action By", "text"],
        [
          "followUp",
          t("การติดตาม", "Follow up"),
          "select",
          [
            ["open", t("เปิด", "Open")],
            ["in_progress", t("ดำเนินการ", "In progress")],
            ["closed", t("ปิด", "Closed")],
          ],
        ],
      ];
      for (const [key, label, type, options] of defs) {
        const l = document.createElement("label");
        l.textContent = label;
        const input = document.createElement(
          type === "select" ? "select" : "input",
        );
        if (options) for (const [v, s] of options) input.add(new Option(s, v));
        input.value = item[key] || (key === "followUp" ? "open" : "");
        if (type !== "select") input.maxLength = key === "remark" ? 2000 : 200;
        input.addEventListener("input", () => {
          item[key] = input.value;
          if (key === "status") el.dataset.status = input.value;
          checkDirty = true;
          checkSummary();
        });
        l.append(input);
        fields.append(l);
      }
      el.append(fields);
      const evidence = document.createElement("label");
      evidence.textContent = t(
        "รูปหลักฐาน (ถ้าต้องการ)",
        "Photo evidence (optional)",
      );
      const file = document.createElement("input");
      file.type = "file";
      file.accept = "image/jpeg,image/png,image/webp";
      file.addEventListener("change", () =>
        run(async () => {
          if (!file.files[0]) return;
          const blob = await compress(file.files[0]),
            requestId = crypto.randomUUID();
          file.disabled = true;
          try {
            await upload(
              `drafts/${profile.uid}/${requestId}/0.jpg`,
              blob,
              () => {},
            );
            const result = await api("uploadChecklistPhoto", {
              ...checklistSelection,
              requestId,
            });
            item.photoPath = result.photoPath;
            checkDirty = true;
            renderChecklist();
            toast(
              t(
                "แนบรูปแล้ว โปรดบันทึกรายการตรวจ",
                "Photo attached. Save the checklist.",
              ),
            );
          } finally {
            file.disabled = false;
          }
        }),
      );
      evidence.append(file);
      el.append(evidence);
      if (item.photoPath) {
        const view = document.createElement("button");
        view.className = "secondary";
        view.textContent = t("ดูรูปหลักฐาน", "View evidence");
        view.addEventListener("click", () =>
          run(() => gallery({ photoPath: item.photoPath })),
        );
        el.append(view);
      }
      card.append(el);
    }
    root.append(card);
  }
  checkSummary();
}
function checkSummary() {
  let meter = $("checkProgress");
  if (!meter) {
    meter = document.createElement("progress");
    meter.id = "checkProgress";
    meter.setAttribute("aria-label", "Checklist completion");
    $("checkSummary").after(meter);
  }
  const all = checklistModel.sections.flatMap((s) => s.items);
  meter.max = all.filter((i) => i.status !== "na").length || 1;
  meter.value = all.filter((i) => i.status === "completed").length;
  const items = checklistModel.sections.flatMap((s) => s.items),
    na = items.filter((i) => i.status === "na").length,
    done = items.filter((i) => i.status === "completed").length;
  $("checkSummary").textContent =
    (checklistSelection
      ? [
          checklistSelection.outlet,
          checklistSelection.date,
          checklistSelection.shift,
        ].join(" · ") + " · "
      : "") +
    t(
      `เสร็จ ${done}/${items.length - na} · N/A ${na} · ${checkDirty ? "มีการแก้ไขที่ยังไม่บันทึก" : "ข้อมูลที่โหลดล่าสุด"}`,
      `Completed ${done}/${items.length - na} · N/A ${na} · ${checkDirty ? "Unsaved changes" : "Last loaded data"}`,
    );
}
async function loadChecklist() {
  if (
    checkDirty &&
    !confirm(
      t(
        "มีรายการที่ยังไม่บันทึก ต้องการโหลดใหม่หรือไม่?",
        "Unsaved changes. Reload checklist?",
      ),
    )
  )
    return;
  const controls = [
    ...$("checkItems").querySelectorAll("input,select,button"),
    $("saveChecklist"),
    $("checkedBy"),
    $("checkNote"),
  ];
  controls.forEach((el) => (el.disabled = true));
  try {
    const selection = formValues($("checklistFilter")),
      data = await api("checklist", selection);
    checklistSelection = selection;
    checklistVersion = data.version;
    checklistModel = data.model || {
      sections: structuredClone(BASE_SECTIONS_V1),
      note: "",
      checkedBy: profile.name,
    };
    $("checkedBy").value = checklistModel.checkedBy || profile.name;
    $("checkNote").value = checklistModel.note || "";
    checkDirty = false;
    renderChecklist();
  } finally {
    controls.forEach((el) => (el.disabled = false));
  }
}
async function setupChecklist() {
  $("checklistFilter").elements.date.value = today();
  listen("checklistFilter", "submit", loadChecklist);
  listen("saveChecklist", "click", async () => {
    if (
      JSON.stringify(formValues($("checklistFilter"))) !==
      JSON.stringify(checklistSelection)
    )
      throw Error(
        t(
          "เปลี่ยนตัวกรองแล้ว โปรดโหลดรายการก่อนบันทึก",
          "Filters changed. Load the selected checklist before saving",
        ),
      );
    checklistModel.note = $("checkNote").value;
    checklistModel.checkedBy = $("checkedBy").value;
    await api("checklist", {
      ...checklistSelection,
      save: true,
      model: checklistModel,
      version: checklistVersion,
    });
    checkDirty = false;
    await loadChecklist();
    toast(t("บันทึกรายการตรวจแล้ว", "Checklist saved"));
  });
  $("print").addEventListener("click", () => window.print());
  $("checkNote").addEventListener("input", () => {
    checkDirty = true;
    checkSummary();
  });
  $("checkedBy").addEventListener("input", () => {
    checkDirty = true;
    checkSummary();
  });
  await loadChecklist();
}
window.addEventListener("beforeunload", (e) => {
  if (checkDirty || (page === "upload" && busy)) {
    e.preventDefault();
    e.returnValue = "";
  }
});
async function pwa() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register("sw.js");
    function update() {
      if (!reg.waiting || !$("update")) return;
      $("update").hidden = false;
      $("update").replaceChildren(
        document.createTextNode(
          t(
            "มีเวอร์ชันใหม่ บันทึกแบบร่างให้เรียบร้อยก่อนอัปเดต ",
            "Update available. Save drafts before updating. ",
          ),
        ),
      );
      const btn = document.createElement("button");
      btn.textContent = t("อัปเดต", "Update");
      btn.addEventListener("click", () => {
        if (busy || checkDirty) {
          toast(t("โปรดบันทึกงานก่อนอัปเดต", "Save your work before updating"));
          return;
        }
        const waiting = reg.waiting;
        waiting.addEventListener("statechange", () => {
          if (waiting.state === "activated") location.reload();
        });
        waiting.postMessage("ACTIVATE_UPDATE");
      });
      $("update").append(btn);
    }
    update();
    reg.addEventListener("updatefound", () =>
      reg.installing?.addEventListener("statechange", update),
    );
  } catch (e) {
    console.warn("PWA unavailable", e);
  }
}
async function boot() {
  if (page === "index") {
    location.replace("login.html");
    return;
  }
  if (page === "login") {
    await ready;
    $("environment").textContent =
      window.LAYA_CONFIG.environment === "emulator"
        ? t(
            "สภาพแวดล้อมทดสอบในเครื่อง · ไม่เชื่อมต่อข้อมูลจริง",
            "Local test environment · No production connection",
          )
        : "";
    let registering = false;
    $("registrationToggle").addEventListener("click", () => {
      registering = !registering;
      document.body.classList.toggle("register-mode", registering);
      document.querySelector(".login-form h1").textContent = registering
        ? t("สมัครพนักงานใหม่", "Register as staff")
        : t("พร้อมสำหรับวันใหม่", "Ready for a new day");
      document.querySelector(".login-form p.muted").textContent = registering
        ? t(
            "ตั้งรหัสผ่านครั้งแรก แล้วให้ผู้จัดการเปิดสิทธิ์",
            "Set your first password, then ask your manager to activate access",
          )
        : t(
            "เข้าสู่ระบบด้วยบัญชีพนักงานของคุณ",
            "Sign in with your staff account",
          );
      const f = $("loginForm");
      for (const id of [
        "registrationFields",
        "registrationConfirm",
        "registrationHelp",
      ])
        $(id).hidden = !registering;
      f.elements.registrationName.required = registering;
      f.elements.confirmPassword.required = registering;
      f.elements.password.minLength = registering ? 12 : 1;
      f.elements.password.autocomplete = registering
        ? "new-password"
        : "current-password";
      f.querySelector("button").textContent = registering
        ? t("สมัครสมาชิก", "Register")
        : t("เข้าสู่ระบบ →", "Sign in →");
      $("registrationToggle").textContent = registering
        ? t("กลับไปเข้าสู่ระบบ", "Back to sign in")
        : t("สมัครพนักงานใหม่", "Register as staff");
      message("");
    });
    listen("loginForm", "submit", async () => {
      const f = $("loginForm"),
        btn = f.querySelector("button");
      btn.disabled = true;
      try {
        if (registering) {
          if (f.elements.password.value !== f.elements.confirmPassword.value)
            throw Error(
              t("รหัสผ่านทั้งสองช่องไม่ตรงกัน", "Passwords do not match"),
            );
          const result = await register(
            f.elements.staffID.value,
            f.elements.password.value,
            f.elements.registrationName.value,
          );
          $("registrationToggle").click();
          f.elements.password.value = "";
          f.elements.confirmPassword.value = "";
          message(
            result.active
              ? t(
                  "บัญชีนี้มีอยู่แล้ว กรุณาเข้าสู่ระบบ",
                  "Account already exists. Please sign in.",
                )
              : t(
                  "สมัครแล้ว — กรุณาแจ้งผู้จัดการเปิดสิทธิ์ใช้งาน",
                  "Registered — ask your manager to activate access",
                ),
          );
          return;
        }
        await login(f.elements.staffID.value, f.elements.password.value);
        const p = await api("profile");
        location.href = p.role === "manager" ? "manager.html" : "staff.html";
      } finally {
        btn.disabled = false;
      }
    });
    const form = $("loginForm");
    form.inert = false;
    form.elements.staffID.disabled = false;
    form.elements.password.disabled = false;
    form.querySelector('button[type="submit"]').disabled = false;
    $("registrationToggle").disabled = false;
    message("");
    return;
  }
  const user = await currentUser();
  if (!user) {
    location.replace("login.html");
    return;
  }
  try {
    profile = await api("profile");
    sessionStorage.setItem("profile:" + user.uid, JSON.stringify(profile));
  } catch (e) {
    if (navigator.onLine) throw e;
    profile = JSON.parse(
      sessionStorage.getItem("profile:" + user.uid) || "null",
    );
    if (!profile) throw e;
  }
  if (["manager", "checklist"].includes(page) && profile.role !== "manager") {
    location.replace("staff.html");
    return;
  }
  $("identity").textContent = profile.name || profile.staffID;
  $("scope").textContent = [profile.department, profile.outlet, profile.shift]
    .filter(Boolean)
    .join(" · ");
  document
    .querySelectorAll("[data-manager]")
    .forEach((el) => (el.hidden = profile.role !== "manager"));
  $("content").hidden = false;
  if (page === "staff") {
    listen("refresh", "click", async () => {
      await loadStaff();
      await loadHistory();
    });
    listen("moreHistory", "click", () => loadHistory(true));
    await loadStaff();
    try {
      await loadHistory();
    } catch (e) {
      if (navigator.onLine) throw e;
    }
  }
  if (page === "upload") await loadUpload();
  if (page === "manager") await setupManager();
  if (page === "checklist") await setupChecklist();
}
setupShell(t);
const loading = document.createElement("div");
loading.className = "loading-panel";
loading.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
if ($("content")) $("content").before(loading);
boot()
  .catch(error)
  .finally(() => loading.remove());
const observer = new MutationObserver(() => {
  observer.disconnect();
  enhance();
  observer.observe(document.querySelector("#content") || document.body, {
    childList: true,
    subtree: true,
  });
});
observer.observe(document.querySelector("#content") || document.body, {
  childList: true,
  subtree: true,
});
if (page === "upload")
  $("uploadForm").insertAdjacentHTML(
    "beforebegin",
    '<div class="upload-steps"><span>1 · ' +
      t("เลือกรูป", "Choose photo") +
      "</span><span>2 · " +
      t("ตรวจและบันทึก", "Preview & note") +
      "</span><span>3 · " +
      t("ส่งตรวจ", "Submit") +
      "</span></div>",
  );
window.addEventListener("beforeprint", () =>
  document.querySelectorAll(".check-category").forEach((el) => {
    el.dataset.printOpen = String(el.open);
    el.open = true;
  }),
);
window.addEventListener("afterprint", () =>
  document
    .querySelectorAll(".check-category")
    .forEach((el) => (el.open = el.dataset.printOpen === "true")),
);

pwa();
