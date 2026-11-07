const fs = require("node:fs");
const tr = (th, en) => `<span data-th="${th}" data-en="${en}">${th}</span>`;
const field = (name, th, en, type = "text", extra = "") =>
  `<label>${tr(th, en)}<input name="${name}" type="${type}" ${extra}></label>`;
const select = (name, th, en, opts) =>
  `<label>${tr(th, en)}<select name="${name}">${opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label>`;
const outlets = [
  ["", "ทุกจุดบริการ / All outlets"],
  ...["The Taste", "The Mangrove", "Aroonsawat", "Room Service", "Banquet"].map(
    (x) => [x, x],
  ),
];
const shift = [
  ["", "ทุกกะ / All shifts"],
  ["Morning", "เช้า / Morning"],
  ["Afternoon", "บ่าย / Afternoon"],
];
function head(title) {
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title.replace(/<[^>]*>/g, "")} · FB Staff APP</title><link rel="stylesheet" href="css/style.css"><link rel="stylesheet" href="css/premium.css"><link rel="icon" href="assets/favicon.svg"><link rel="manifest" href="manifest.json"><link rel="apple-touch-icon" href="icons/apple-touch-icon.png"><meta name="theme-color" content="#163b36"></head>`;
}
const scripts =
  '<script src="js/firebase-config.js"></script><script type="module" src="js/bundle.js"></script></body></html>';
function shell(page, title, subtitle, body) {
  return (
    head(title) +
    `<body data-page="${page}"><aside class="sidebar"><div><div class="logo">FB Staff APP</div><p class="eyebrow">HOTEL OPERATIONS · V4</p></div><nav><a href="staff.html" ${page === "staff" ? 'aria-current="page"' : ""}>${tr("งานของฉัน", "My workspace")}</a><a href="manager.html" data-manager hidden ${page === "manager" ? 'aria-current="page"' : ""}>${tr("ภาพรวมผู้จัดการ", "Manager overview")}</a><a href="checklist.html" data-manager hidden ${page === "checklist" ? 'aria-current="page"' : ""}>${tr("รายการตรวจประจำวัน", "Daily checklist")}</a><a href="https://wuttichaikoji-oss.github.io/LAYA-FB/#dashboard" target="_blank" rel="noopener noreferrer">Operations HUB ↗</a></nav><footer>Thoughtful service.<br>Every task, every day.</footer></aside><main class="shell"><header class="topbar"><div><b id="identity">FB Staff APP</b><div class="small" id="scope">Hotel operations</div></div><div class="row"><span id="connection" role="status"></span><button id="language" class="secondary" aria-label="Switch language">EN</button><button id="logout" class="secondary">${tr("ออกจากระบบ", "Sign out")}</button></div></header><div id="update" class="notice" hidden></div><div id="message" class="notice" role="alert"></div><div class="intro"><div class="eyebrow">FB Staff APP · HOTEL OPERATIONS</div><h1>${title}</h1><div class="muted">${subtitle}</div></div><div id="content" hidden>${body}</div></main><dialog id="gallery"><button id="closeGallery" class="secondary">${tr("ปิด", "Close")}</button><div class="gallery section-gap" id="galleryImages"></div></dialog>${scripts}`
  );
}
const stats = '<div class="stats" id="stats"></div>';
fs.writeFileSync(
  "index.html",
  head("FB Staff APP") +
    '<body data-page="index"><a href="login.html">เข้าสู่ระบบ / Sign in</a>' +
    scripts,
);
fs.writeFileSync(
  "login.html",
  head("เข้าสู่ระบบ") +
    `<body data-page="login"><div class="login-shell"><section class="login-story"><div><div class="logo">FB Staff APP</div><div class="eyebrow">HOTEL OPERATIONS</div></div><div><div class="eyebrow">A BETTER DAY, TOGETHER</div><h1>Exceptional service.<br>One task at a time.</h1><p>ทุกรายละเอียดสร้างประสบการณ์ที่ดีให้แขก<br>เริ่มต้นวันทำงาน ดูงาน ถ่ายรูป และส่งตรวจในที่เดียว</p></div><footer class="small">FB Staff APP</footer></section><section class="login-form"><div class="row between"><div class="eyebrow">WELCOME BACK</div><button id="language" class="secondary">EN</button></div><h1>${tr("พร้อมสำหรับวันใหม่", "Ready for a new day")}</h1><p class="muted">${tr("เข้าสู่ระบบด้วยบัญชีพนักงานของคุณ", "Sign in with your staff account")}</p><div id="message" class="notice" role="alert">${tr("กำลังโหลดระบบ หากข้อความนี้ค้าง ให้เปิดแอปจากเว็บที่ติดตั้งแล้วหรือจากระบบทดสอบในเครื่อง", "Loading. If this message stays, open the deployed app or start the local test server.")}</div><form id="loginForm" method="post" inert><div id="registrationFields" hidden>${field("registrationName", "ชื่อ–นามสกุล", "Full name", "text", 'autocomplete="name" maxlength="200"')}</div>${field("staffID", "รหัสพนักงาน", "Staff ID", "text", 'disabled required autocomplete="username"')}${field("password", "รหัสผ่าน", "Password", "password", 'disabled required autocomplete="current-password"')}<div id="registrationConfirm" hidden>${field("confirmPassword", "ยืนยันรหัสผ่าน", "Confirm password", "password", 'autocomplete="new-password"')}</div><button type="submit" disabled>${tr("เข้าสู่ระบบ →", "Sign in →")}</button></form><button id="registrationToggle" type="button" disabled class="secondary section-gap">${tr("สมัครพนักงานใหม่", "Register as staff")}</button><p id="registrationHelp" class="small" hidden>${tr("ตั้งรหัสผ่าน 6–9 ตัว แล้วแจ้งผู้จัดการเปิดสิทธิ์ก่อนใช้งาน หากสมัครค้าง ให้กรอกข้อมูลเดิมแล้วลองอีกครั้ง", "Use 6–9 characters. Ask your manager to activate access. Retry with the same credentials if interrupted.")}</p><p id="environment" class="small"></p></section></div>${scripts}`,
);
fs.writeFileSync(
  "staff.html",
  shell(
    "staff",
    tr("งานของฉันวันนี้", "My day at a glance"),
    tr(
      "ดูงานที่ได้รับมอบหมาย ส่งหลักฐาน และติดตามผลการตรวจ",
      "Your assignments, evidence and review results",
    ),
    stats +
      `<div class="grid two"><section class="card"><div class="row between"><h2>${tr("งานที่ได้รับมอบหมาย", "Assigned tasks")}</h2><button id="refresh" class="secondary">${tr("รีเฟรช", "Refresh")}</button></div><div id="quota" class="small"></div><div id="tasks"></div></section><section class="card"><h2>${tr("ประวัติการทำงาน", "Work history")}</h2><div id="achievement" class="notice"></div><div id="history"></div><button id="moreHistory" class="secondary" hidden>${tr("ดูเพิ่มเติม", "Load more")}</button></section></div>`,
  ),
);
fs.writeFileSync(
  "upload.html",
  shell(
    "upload",
    tr("ส่งงานให้ผู้จัดการตรวจ", "Submit your work"),
    tr(
      "เพิ่มรูปหลักฐานและบันทึก แล้วกดส่งงาน",
      "Add evidence and a note, then submit",
    ),
    `<div class="grid two"><section class="card"><div class="eyebrow">YOUR ASSIGNMENT</div><h2 id="taskTitle"></h2><p id="taskDescription"></p><p id="taskDetails" class="small"></p><div id="rejection" class="notice"></div><p class="small">${tr("ส่งสำเร็จเมื่อ server ยืนยันเท่านั้น หากเครือข่ายขัดข้อง ให้กดส่งซ้ำจากแบบร่างเดิม", "Saved only after server confirmation. Retry the same draft after connection loss.")}</p><a href="staff.html">← ${tr("กลับไปงานวันนี้", "Back to today")}</a></section><section class="card"><h2>${tr("หลักฐานการทำงาน", "Work evidence")}</h2><form id="uploadForm"><label>${tr("รูปภาพ สูงสุด 10 รูป (JPEG, PNG, WebP)", "Up to 10 photos (JPEG, PNG, WebP)")}<input id="photo" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><label>${tr("บันทึกเพิ่มเติม", "Optional note")}<textarea id="note" maxlength="2000"></textarea></label><div id="draftStatus" class="small"></div><div id="previews" class="row section-gap"></div><progress id="progress" max="100" value="0" aria-label="Upload progress"></progress><div class="actions"><button type="submit" id="submitWork">${tr("ส่งงาน", "Submit work")}</button><button type="button" id="discardDraft" class="secondary">${tr("ล้างแบบร่าง", "Discard draft")}</button></div></form></section></div>`,
  ),
);
const taskForm = `<form id="taskForm"><input type="hidden" name="id"><h2>${tr("มอบหมายงาน / แก้ไขงาน", "Assign or edit task")}</h2><label>${tr("แม่แบบงาน", "Task template")}<select id="template"><option value="">— เลือก / Select —</option></select></label>${field("title", "ชื่องาน", "Task title", "text", 'required maxlength="200"')}${field("description", "รายละเอียด", "Description", "text", 'maxlength="2000"')}<div class="grid two">${field("department", "แผนก", "Department")}${select("outlet", "จุดบริการ", "Outlet", outlets)}${select(
  "priority",
  "ความสำคัญ",
  "Priority",
  [
    ["Normal", "ปกติ / Normal"],
    ["High", "สูง / High"],
    ["Critical", "เร่งด่วน / Critical"],
  ],
)}${select("shift", "กะทำงาน", "Shift", shift)}</div><label>${tr("มอบหมายให้", "Assign to")}<select name="assignedTo" id="assignee"><option value="all">ทุกคน / All staff</option><option value="department">แผนก / Department</option><option value="outlet">จุดบริการ / Outlet</option></select></label><div class="grid two">${select(
  "recurrence",
  "ทำซ้ำ",
  "Recurrence",
  [
    ["once", "ครั้งเดียว / Once"],
    ["daily", "ทุกวัน / Daily"],
    ["weekly", "ทุกสัปดาห์ / Weekly"],
  ],
)}${field("forDate", "วันที่เริ่ม / วันที่ทำ", "Start / Task date", "date", "required")}${field("endDate", "วันที่สิ้นสุด (ถ้ามี)", "End date (optional)", "date")}${field("dueTime", "เวลาครบกำหนด", "Due time", "time")}</div><label>${tr("วันในสัปดาห์ (งานรายสัปดาห์)", "Weekdays (weekly task)")}<input name="weekdays" placeholder="0,1,2,3,4,5,6" aria-label="Weekdays"></label><label class="row"><input name="requiredPhoto" type="checkbox" checked>${tr("ต้องมีรูปหลักฐาน", "Photo required")}</label><label class="row"><input name="active" type="checkbox" checked>${tr("เปิดใช้งาน", "Active")}</label><div class="actions"><button type="submit">${tr("บันทึกงาน", "Save task")}</button><button type="reset" class="secondary">${tr("สร้างงานใหม่", "New task")}</button></div></form>`;
const staffForm = `<form id="staffForm"><input name="id" type="hidden"><h2>${tr("บัญชีและกะพนักงาน", "Staff accounts and shifts")}</h2><div class="grid two">${field("staffID", "รหัสพนักงาน (สร้างใหม่)", "Staff ID (new account)", "text")}${field("password", "รหัสผ่านใหม่ 6–9 ตัว", "New password, 6–9 characters", "password", 'autocomplete="new-password"')}${field("name", "ชื่อพนักงาน", "Name", "text", "required")}${field("position", "ตำแหน่ง", "Position")}${field("department", "แผนก", "Department")}${select("outlet", "จุดบริการ", "Outlet", outlets)}${select("shift", "กะ", "Shift", shift)}</div><label class="row"><input name="active" type="checkbox" checked>${tr("เปิดสิทธิ์ใช้งาน", "Active access")}</label><p class="small">${tr("บัญชีใหม่มีสิทธิ์พนักงานเท่านั้น · ผู้สมัครใหม่ต้องเปิดสิทธิ์และบันทึก · รหัสพนักงานแก้ไขไม่ได้ · ตั้งรหัสผ่านใหม่ใช้ปุ่มแยกจากบันทึก", "New accounts have staff permissions only")}</p><div class="actions"><button type="submit">${tr("บันทึกพนักงาน", "Save staff")}</button><button type="button" id="resetStaffPassword" class="secondary" hidden>${tr("ตั้งรหัสผ่านใหม่", "Reset password")}</button><button type="reset" class="secondary">${tr("สร้างบัญชีใหม่", "New account")}</button></div></form>`;
fs.writeFileSync(
  "manager.html",
  shell(
    "manager",
    tr("ภาพรวมการปฏิบัติงาน", "Operations overview"),
    tr(
      "ติดตามงานประจำวัน ดูหลักฐาน และดูแลทีมของคุณ",
      "Monitor daily work, review evidence and support your team",
    ),
    `<section class="card"><form id="filterForm" class="filters">${field("start", "ตั้งแต่", "From", "date", "required")}${field("end", "ถึง (ไม่เกิน 31 วัน)", "To (max 31 days)", "date", "required")}${field("department", "แผนก", "Department")}${select("outlet", "จุดบริการ", "Outlet", outlets)}<label>${tr("พนักงาน", "Employee")}<select name="employee" id="employeeFilter"><option value="">ทุกคน / All</option></select></label><button type="submit">${tr("แสดงผล", "Apply")}</button></form></section>${stats}<div class="tabs" role="tablist"><button data-tab="review" role="tab" aria-selected="true">${tr("รอตรวจและรายงาน", "Review & reports")}</button><button data-tab="manageTasks" role="tab" aria-selected="false">${tr("จัดการงาน", "Manage tasks")}</button><button data-tab="manageStaff" role="tab" aria-selected="false">${tr("จัดการพนักงาน", "Manage staff")}</button></div><section id="review" class="panel"><div class="card"><div class="row between"><h2>${tr("งานที่ส่งตรวจ", "Submitted work")}</h2><label class="row"><input type="checkbox" id="showApproved">${tr("แสดงที่อนุมัติแล้ว", "Show approved")}</label></div><div id="submissions"></div><div class="actions"><button id="prevSub" class="secondary">←</button><span id="pageLabel" class="small"></span><button id="nextSub" class="secondary">→</button></div></div><div class="card section-gap"><div class="row between"><h2>${tr("รายงานผลปฏิบัติงาน", "Performance report")}</h2><div class="actions"><button id="export" class="secondary">CSV / Excel</button><button id="print" class="secondary">${tr("พิมพ์ / บันทึก PDF", "Print / Save PDF")}</button></div></div><p class="report-note">${tr("อัตราสำเร็จ = งานที่อนุมัติ ÷ งานที่มอบหมายรายคนต่อวัน · งานรอตรวจยังไม่ถือว่าสำเร็จ · รายงานย้อนหลังอ้างอิงการมอบหมายและแผนกปัจจุบัน", "Completion = approved staff-task-days ÷ assigned staff-task-days. Pending is incomplete. Historical reports use current assignments and profiles.")}</p><div id="report"></div></div></section><section id="manageTasks" class="panel" hidden><div class="grid two"><div class="card">${taskForm}</div><div class="card"><h2>${tr("รายการงาน", "Task library")}</h2><div id="taskList"></div></div></div></section><section id="manageStaff" class="panel" hidden><div class="grid two"><div class="card">${staffForm}</div><div class="card"><h2>${tr("ทีมและคะแนนสะสม", "Team and points")}</h2><div id="staffList"></div></div></div></section>`,
  ),
);
fs.writeFileSync(
  "checklist.html",
  shell(
    "checklist",
    tr("รายการตรวจประจำวัน", "Daily operations checklist"),
    tr(
      "เก็บรายการตรวจเดิม พร้อมสถานะ ผู้รับผิดชอบ และการติดตาม",
      "Original checklist with status, responsibility and follow-up",
    ),
    `<section class="card"><form id="checklistFilter" class="filters">${field("date", "วันที่", "Date", "date", "required")}${select("outlet", "จุดบริการ", "Outlet", outlets.slice(1))}${select("shift", "กะ", "Shift", shift.slice(1))}<button type="submit">${tr("โหลดรายการ", "Load checklist")}</button></form><label>${tr("ผู้ตรวจ / ผู้จัดการ", "Reviewed by / Manager")}<input id="checkedBy" maxlength="200"></label><label>${tr("บันทึก", "Note")}<textarea id="checkNote" maxlength="4000"></textarea></label><div id="checkSummary" class="notice"></div><div class="actions"><button id="saveChecklist">${tr("บันทึกรายการตรวจ", "Save checklist")}</button><button id="print" class="secondary">${tr("พิมพ์ / PDF", "Print / PDF")}</button></div></section><div id="checkItems" class="section-gap"></div>`,
  ),
);
console.log("Generated six HTML routes");
