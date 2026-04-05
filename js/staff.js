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
  el("todayLabel").textContent = todayStr();

  await renderTasks(user.uid, profile?.department || "");
  await loadAllStaffPoints();
}

async function renderTasks(uid, dept){
  const body = el("taskRows");
  body.innerHTML = "<tr><td colspan='5' class='small'>กำลังโหลด...</td></tr>";

  const tasks = [];
  const q1 = await db().collection("tasks").where("active","==",true).where("assignedTo","==",uid).get();
  q1.forEach(d=> tasks.push({id:d.id, ...d.data()}));

  if(dept){
    const q2 = await db().collection("tasks").where("active","==",true).where("assignedTo","==","department").where("department","==",dept).get();
    q2.forEach(d=> tasks.push({id:d.id, ...d.data()}));
  }

  const q3 = await db().collection("tasks").where("active","==",true).where("assignedTo","==","all").get();
  q3.forEach(d=> tasks.push({id:d.id, ...d.data()}));

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

  const today = todayStr();
  const subSnap = await db().collection("submissions")
    .where("staffUid","==",uid)
    .where("date","==",today)
    .get();

  const statusByTask = new Map();
  subSnap.forEach(d=> statusByTask.set(d.data().taskId, d.data().status || "waiting"));

  body.innerHTML = "";
  for(const t of uniq){
    const st = statusByTask.get(t.id);
    const action = st ? statusBadge(st) : `<button class="success" onclick="goUpload('${t.id}')">ส่งงาน</button>`;

    body.insertAdjacentHTML("beforeend", `
      <tr>
        <td><b>${escapeHtml(t.title || "-")}</b><div class="small">${escapeHtml(t.description||"")}</div></td>
        <td>${escapeHtml(t.department || "-")}</td>
        <td>${escapeHtml(t.priority || "Normal")}</td>
        <td>${action}</td>
        <td class="small">${escapeHtml(today)}</td>
      </tr>
    `);
  }
}

function goUpload(taskId){
  window.location.href = `upload.html?taskId=${encodeURIComponent(taskId)}`;
}


async function loadAllStaffPoints(){
  const body = el("allPointsRows");
  if(!body) return;

  body.innerHTML = "<tr><td colspan='5' class='small'>กำลังโหลดคะแนน...</td></tr>";

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

    rows.sort((a,b)=> (b.points - a.points) || a.staffID.localeCompare(b.staffID));

    if(!rows.length){
      body.innerHTML = "<tr><td colspan='5' class='small'>ยังไม่มีข้อมูลพนักงาน</td></tr>";
      return;
    }

    body.innerHTML = "";
    for(const r of rows){
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
  }catch(e){
    console.error(e);
    body.innerHTML = "<tr><td colspan='5' class='small'>โหลดคะแนนไม่สำเร็จ</td></tr>";
    toast("โหลดคะแนนไม่สำเร็จ: " + (e?.message||e), "danger");
  }
}
