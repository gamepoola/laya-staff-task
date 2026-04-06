const DAILY_SUBMISSION_LIMIT = 2;

async function getTodaySubmissionSummary(uid){
  const today = todayStr();
  const subSnap = await db().collection("submissions")
    .where("staffUid","==",uid)
    .where("date","==",today)
    .get();

  const statusByTask = new Map();
  let total = 0;

  subSnap.forEach(d => {
    const data = d.data() || {};
    total += 1;
    if (data.taskId && !statusByTask.has(data.taskId)) {
      statusByTask.set(data.taskId, data.status || "waiting");
    }
  });

  return {
    today,
    total,
    remaining: Math.max(0, DAILY_SUBMISSION_LIMIT - total),
    reachedLimit: total >= DAILY_SUBMISSION_LIMIT,
    statusByTask
  };
}

function updateDailyQuota(summary){
  if (el("todaySubmissionCount")) {
    el("todaySubmissionCount").textContent = `${summary.total}/${DAILY_SUBMISSION_LIMIT}`;
  }
  if (el("dailyQuotaLabel")) {
    el("dailyQuotaLabel").textContent = summary.reachedLimit
      ? `ครบ ${DAILY_SUBMISSION_LIMIT} งานแล้ววันนี้`
      : `เหลือส่งได้อีก ${summary.remaining} งานวันนี้`;
  }
}

async function loadStaffPage(){
  const user = await requireAuth();
  const profile = await getProfile(user.uid);

  if(!profile){
    toast("ยังไม่มีโปรไฟล์พนักงานในระบบ (ให้ Manager เพิ่มใน collection staff)", "danger");
  }

  el("staffName").textContent = profile?.name || "-";
  el("staffPosition").textContent = profile?.position || "-";
  el("staffDepartment").textContent = profile?.department || "-";
  if (el("staffPoints")) el("staffPoints").textContent = String(profile?.points ?? 0);
  el("staffCode").textContent = profile?.staffID || "-";

  const summary = await getTodaySubmissionSummary(user.uid);
  el("todayLabel").textContent = summary.today;
  updateDailyQuota(summary);

  await renderTasks(user.uid, profile?.department || "", summary);
  await loadAllStaffPoints(profile);
}

async function renderTasks(uid, dept, summary){
  const body = el("taskRows");
  body.innerHTML = "<tr><td colspan='5' class='small'>กำลังโหลด...</td></tr>";

  const tasks = [];
  const q1 = await db().collection("tasks").where("active","==",true).where("assignedTo","==",uid).get();
  q1.forEach(d => tasks.push({id:d.id, ...d.data()}));

  if(dept){
    const q2 = await db().collection("tasks").where("active","==",true).where("assignedTo","==","department").where("department","==",dept).get();
    q2.forEach(d => tasks.push({id:d.id, ...d.data()}));
  }

  const q3 = await db().collection("tasks").where("active","==",true).where("assignedTo","==","all").get();
  q3.forEach(d => tasks.push({id:d.id, ...d.data()}));

  const seen = new Set();
  const uniq = [];
  for(const t of tasks){
    if(seen.has(t.id)) continue;
    seen.add(t.id);
    uniq.push(t);
  }

  if(!uniq.length){
    body.innerHTML = "<tr><td colspan='5' class='small'>วันนี้ยังไม่มีงานที่ถูกมอบหมาย</td></tr>";
    return;
  }

  body.innerHTML = "";
  for(const t of uniq){
    const st = summary.statusByTask.get(t.id);
    let action = "";

    if (st) {
      action = statusBadge(st);
    } else if (summary.reachedLimit) {
      action = `<button class="secondary" disabled>ครบ 2 งานแล้ว</button>`;
    } else {
      action = `<button class="success" onclick="goUpload('${t.id}')">ส่งงาน</button>`;
    }

    body.insertAdjacentHTML("beforeend", `
      <tr>
        <td><b>${escapeHtml(t.title || "-")}</b><div class="small">${escapeHtml(t.description||"")}</div></td>
        <td>${escapeHtml(t.department || "-")}</td>
        <td>${escapeHtml(t.priority || "Normal")}</td>
        <td>${action}</td>
        <td class="small">${escapeHtml(summary.today)}</td>
      </tr>
    `);
  }
}

function goUpload(taskId){
  window.location.href = `upload.html?taskId=${encodeURIComponent(taskId)}`;
}

async function loadAllStaffPoints(profile){
  const body = el("allPointsRows");
  if(!body) return;

  body.innerHTML = "<tr><td colspan='5' class='small'>กำลังโหลดคะแนน...</td></tr>";

  const renderRows = (rows) => {
    if(!Array.isArray(rows) || !rows.length){
      body.innerHTML = "<tr><td colspan='5' class='small'>ยังไม่มีข้อมูลพนักงาน</td></tr>";
      return;
    }

    const cleanRows = rows.map(r => ({
      staffID: r?.staffID || "",
      name: r?.name || "",
      position: r?.position || "-",
      department: r?.department || "-",
      points: Number(r?.points || 0)
    })).sort((a,b)=> (b.points - a.points) || String(a.staffID).localeCompare(String(b.staffID)));

    body.innerHTML = "";
    for(const r of cleanRows){
      body.insertAdjacentHTML("beforeend", `
        <tr>
          <td><b>${escapeHtml(r.staffID)}</b></td>
          <td>${escapeHtml(r.name)}</td>
          <td>${escapeHtml(r.position)}</td>
          <td>${escapeHtml(r.department)}</td>
          <td><b>${r.points}</b></td>
        </tr>
      `);
    }
  };

  try{
    const snap = await db().collection("staff").limit(500).get();
    const rows = [];

    snap.forEach(doc => {
      const s = doc.data() || {};
      if ((s.role || "staff") === "manager") return;
      rows.push({
        staffID: s.staffID || "",
        name: s.name || "",
        position: s.position || "-",
        department: s.department || "-",
        points: Number(s.points || 0)
      });
    });

    renderRows(rows);
  }catch(e){
    console.warn("loadAllStaffPoints direct query failed, fallback to profile.sharedLeaderboard", e);

    const fallbackRows = Array.isArray(profile?.sharedLeaderboard) ? profile.sharedLeaderboard : [];
    if(fallbackRows.length){
      renderRows(fallbackRows);
      toast("เปิดดูคะแนนจากข้อมูลสำรองในโปรไฟล์แล้ว", "info");
      return;
    }

    body.innerHTML = "<tr><td colspan='5' class='small'>โหลดคะแนนไม่สำเร็จ</td></tr>";
    toast("โหลดคะแนนไม่สำเร็จ: " + (e?.message||e), "danger");
  }
}
