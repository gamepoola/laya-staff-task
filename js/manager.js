async function loadManagerPage(){
  const user = await requireAuth();
  const profile = await getProfile(user.uid);

  if(profile?.role !== "manager"){
    toast("หน้านี้สำหรับ Manager เท่านั้น", "danger");
    window.location.href="staff.html";
    return;
  }

  el("mgrName").textContent = profile?.name || "Manager";
  el("mgrDept").textContent = profile?.department || "-";

  el("filterDate").value = todayStr();
  el("filterBtn").onclick = async ()=>{
    await loadSubmissions();
    await loadNotSubmittedReport();
  };
  el("cleanupBtn").onclick = cleanupOld;
  el("createStaffBtn").onclick = createStaff;
  el("createTaskBtn").onclick = createTask;
  el("assignMode").onchange = onAssignModeChange;
  el("reportBtn").onclick = loadNotSubmittedReport;
  if (el("refreshPointsBtn")) el("refreshPointsBtn").onclick = loadStaffPoints;

  await loadSubmissions();
  await loadTaskList();
  await loadNotSubmittedReport();
  await loadStaffPoints();
}

async function loadKpi(date){
  const snap = await db().collection("submissions").where("date","==",date).get();
  let total=0, waiting=0, approved=0, rejected=0;
  snap.forEach(d=>{
    total++;
    const s = d.data().status || "waiting";
    if(s==="waiting") waiting++;
    if(s==="approved") approved++;
    if(s==="rejected") rejected++;
  });
  el("kpiTotal").textContent = total;
  el("kpiWaiting").textContent = waiting;
  el("kpiApproved").textContent = approved;
  el("kpiRejected").textContent = rejected;
}

async function loadSubmissions(){
  const date = el("filterDate").value || todayStr();
  const body = el("subRows");
  body.innerHTML = "<tr><td colspan='8' class='small'>กำลังโหลด...</td></tr>";

  let snap;
  try{
    snap = await db().collection("submissions")
      .where("date","==",date)
      .orderBy("createdAt","desc")
      .get();
  }catch(_){
    snap = await db().collection("submissions").where("date","==",date).get();
  }

  if(snap.empty){
    body.innerHTML = "<tr><td colspan='8' class='small'>ยังไม่มีการส่งงานในวันที่เลือก</td></tr>";
    await loadKpi(date);
    return;
  }

  const taskIds = new Set();
  snap.forEach(d=> taskIds.add(d.data().taskId));
  const taskMap = new Map();
  await Promise.all([...taskIds].map(async tid=>{
    const t = await db().collection("tasks").doc(tid).get();
    taskMap.set(tid, t.exists ? (t.data().title || tid) : tid);
  }));

  body.innerHTML = "";
  snap.forEach(doc=>{
    const s = doc.data();
    const thumb = s.photoURL
      ? `<a href="${s.photoURL}" target="_blank"><img class="thumb" src="${s.photoURL}" alt="photo"/></a>`
      : "-";

    body.insertAdjacentHTML("beforeend", `
      <tr>
        <td>${thumb}</td>
        <td><b>${escapeHtml(s.staffName||"-")}</b><div class="small">${escapeHtml(s.staffID||"")}</div></td>
        <td>${escapeHtml(taskMap.get(s.taskId) || s.taskId)}</td>
        <td>${escapeHtml(s.department||"-")}</td>
        <td>${statusBadge(s.status || "waiting")}</td>
        <td class="small">${escapeHtml(s.date || "-")}</td>
        <td>
          <div class="row" style="gap:8px; align-items:flex-start;">
            <button class="success" onclick="setStatus('${doc.id}','approved')">Approve</button>
            <button class="secondary" onclick="setStatus('${doc.id}','rejected')">Reject</button>
            <button class="danger" onclick="deleteSubmission('${doc.id}')">Delete</button>
          </div>
        </td>
        <td class="small">${escapeHtml(s.photoPath||"")}</td>
      </tr>
    `);
  });

  await loadKpi(date);
}

async function setStatus(id, status){
  try{
    const user = await requireAuth();
    const subRef = db().collection("submissions").doc(id);

    await db().runTransaction(async (tx) => {
      const snap = await tx.get(subRef);
      if (!snap.exists) throw new Error("Submission not found");

      const data = snap.data() || {};
      const alreadyAwarded = !!data.pointsAwarded;
      const staffUid = data.staffUid;

      tx.update(subRef, {
        status,
        reviewerUid: user.uid,
        reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Award points only once per submission, when status becomes 'approved'
      // Points by priority: Normal=1, High=2, Critical=3
      if (status === "approved" && staffUid && !alreadyAwarded) {
        let pointsToAdd = 1;

        if (data.taskId) {
          const taskRef = db().collection("tasks").doc(String(data.taskId));
          const taskSnap = await tx.get(taskRef);
          if (taskSnap.exists) {
            const t = taskSnap.data() || {};
            const p = String(t.priority || "Normal").toLowerCase();
            if (p === "high") pointsToAdd = 2;
            else if (p === "critical") pointsToAdd = 3;
            else pointsToAdd = 1;
          }
        }

        const staffRef = db().collection("staff").doc(staffUid);
        tx.set(staffRef, { points: firebase.firestore.FieldValue.increment(pointsToAdd) }, { merge: true });
        tx.update(subRef, { pointsAwarded: true, pointsAwardedValue: pointsToAdd });
      }
    });

    toast("อัปเดตสถานะแล้ว ✅");
    await loadSubmissions();
    await loadNotSubmittedReport();
    await loadStaffPoints();
  }catch(e){
    console.error(e);
    toast("อัปเดตไม่สำเร็จ: " + (e?.message||e), "danger");
  }
}

async function deleteSubmission(id){
  if(!requireManagerPin()){
    toast("PIN ไม่ถูกต้อง", "danger");
    return;
  }
  if(!confirm("ลบรายการนี้และรูปภาพ?")) return;

  try{
    const ref = db().collection("submissions").doc(id);
    const snap = await ref.get();
    if(!snap.exists) return;

    const data = snap.data();
    if(data.photoPath){
      try{ await storage().ref().child(data.photoPath).delete(); }catch(_){}
    }
    await ref.delete();
    toast("ลบแล้ว ✅");
    await loadSubmissions();
    await loadNotSubmittedReport();
  }catch(e){
    console.error(e);
    toast("ลบไม่สำเร็จ: " + (e?.message||e), "danger");
  }
}

async function cleanupOld(){
  if(!requireManagerPin()){
    toast("PIN ไม่ถูกต้อง", "danger");
    return;
  }
  const days = Number(window.__RETENTION_DAYS__ || 7);
  if(!confirm(`ลบ submission/รูปที่เก่ากว่า ${days} วัน?`)) return;

  try{
    const now = new Date();
    const cutoff = new Date(now.getTime() - days*24*60*60*1000);
    const cutoffStr = todayStr(cutoff);

    const snap = await db().collection("submissions").where("date","<",cutoffStr).get();
    if(snap.empty){
      toast("ไม่มีรายการเก่ากว่าเกณฑ์", "info");
      return;
    }

    let n=0;
    for(const doc of snap.docs){
      const s = doc.data();
      if(s.photoPath){
        try{ await storage().ref().child(s.photoPath).delete(); }catch(_){}
      }
      await doc.ref.delete();
      n++;
    }
    toast(`Cleanup สำเร็จ: ลบ ${n} รายการ ✅`);
    await loadSubmissions();
    await loadNotSubmittedReport();
  }catch(e){
    console.error(e);
    toast("Cleanup ไม่สำเร็จ: " + (e?.message||e), "danger");
  }
}

// =====================
// Report: Who hasn't submitted today?
// Logic: Staff who have >=1 applicable active task AND submitted count < assigned task count for the selected date
// =====================
async function loadNotSubmittedReport(){
  const date = el("filterDate").value || todayStr();
  const body = el("reportRows");
  body.innerHTML = "<tr><td colspan='6' class='small'>กำลังคำนวณรายงาน...</td></tr>";

  // Fetch all active tasks once
  const taskSnap = await db().collection("tasks").where("active","==",true).get();
  const tasks = taskSnap.docs.map(d=>({id:d.id, ...d.data()}));

  // Fetch staff (limit 500 for prototype)
  const staffSnap = await db().collection("staff").limit(500).get();
  const staffList = staffSnap.docs.map(d=>({uid:d.id, ...d.data()}))
    .filter(s => (s.role || "staff") !== "manager");

  // Fetch submissions of the date
  const subSnap = await db().collection("submissions").where("date","==",date).get();
  const submittedByStaff = new Map(); // uid -> Set(taskId)
  subSnap.forEach(d=>{
    const s = d.data();
    const uid = s.staffUid;
    if(!uid || !s.taskId) return;
    if(!submittedByStaff.has(uid)) submittedByStaff.set(uid, new Set());
    submittedByStaff.get(uid).add(s.taskId);
  });

  // Compute per staff assigned tasks
  const rows = [];
  for(const st of staffList){
    const dept = st.department || "";
    const assigned = [];
    for(const t of tasks){
      if(t.assignedTo === "all") assigned.push(t.id);
      else if(t.assignedTo === "department" && dept && t.department === dept) assigned.push(t.id);
      else if(t.assignedTo === st.uid) assigned.push(t.id);
    }
    const assignedCount = assigned.length;
    if(assignedCount === 0) continue;

    const submittedSet = submittedByStaff.get(st.uid) || new Set();
    const submittedCount = submittedSet.size;
    const missing = assignedCount - submittedCount;

    if(missing > 0){
      rows.push({
        staffID: st.staffID || "",
        name: st.name || "",
        department: st.department || "-",
        position: st.position || "-",
        assignedCount, submittedCount, missing
      });
    }
  }

  rows.sort((a,b)=> (b.missing - a.missing) || a.name.localeCompare(b.name));

  el("kpiNotSubmitted").textContent = rows.length;

  if(rows.length === 0){
    body.innerHTML = "<tr><td colspan='6' class='small'>✅ ทุกคนส่งงานครบ (ตามงานที่ได้รับมอบหมาย) สำหรับวันที่เลือก</td></tr>";
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
        <td>${r.submittedCount} / ${r.assignedCount}</td>
        <td><span class="badge rejected">missing ${r.missing}</span></td>
      </tr>
    `);
  }
}

// ---------- Tasks ----------
async function createTask(){
  const title = el("taskTitle").value.trim();
  const description = el("taskDescription").value.trim();
  const department = el("taskDept").value.trim() || "-";
  const priority = el("taskPriority").value;
  const mode = el("assignMode").value;
  const assignedToInput = el("assignedTo").value.trim();

  if(!title){
    toast("กรุณาใส่ชื่องาน", "danger"); 
    return;
  }

  // Warn about department exact-match behavior
  if(mode === "department" && !department){
    toast("Assign mode = Department ต้องระบุ Department ให้ตรงกับในโปรไฟล์พนักงาน", "danger");
    return;
  }

  let assignedTo = "all";
  if(mode==="all") assignedTo = "all";
  if(mode==="department") assignedTo = "department";
  if(mode==="staffid") {
    if(!assignedToInput){
      toast("Assign mode = Specific StaffID ต้องใส่ Staff ID", "danger");
      return;
    }
    assignedTo = assignedToInput;
  }

  try{
    // If Firestore rules deny, we will show the real error instead of silently failing.
    const docRef = await db().collection("tasks").add({
      title, description, department, priority,
      assignedTo,
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    el("taskTitle").value="";
    el("taskDescription").value="";
    el("taskDept").value="";
    el("assignedTo").value="";

    await normalizeTaskAssignment(docRef.id);
    toast("สร้างงานแล้ว ✅");
    await loadTaskList();
    await loadNotSubmittedReport();
  }catch(e){
    console.error(e);
    const msg = (e && e.message) ? e.message : String(e);
    // Most common: Missing or insufficient permissions
    toast("สร้างงานไม่สำเร็จ: " + msg, "danger");
  }
}

async function normalizeTaskAssignment(taskId){
  const ref = db().collection("tasks").doc(taskId);
  const snap = await ref.get();
  if(!snap.exists) return;
  const t = snap.data();
  if(!t.assignedTo || t.assignedTo==="all" || t.assignedTo==="department") return;

  const staffID = String(t.assignedTo);
  const q = await db().collection("staff").where("staffID","==",staffID).limit(1).get();
  if(!q.empty){
    await ref.update({assignedTo: q.docs[0].id});
  }else{
    toast("ไม่พบ StaffID นี้ใน staff (งานจะยังไม่ผูกกับคน จนกว่าจะมี staff profile)", "danger");
  }
}

async function loadTaskList(){
  const body = el("taskRows");
  body.innerHTML = "<tr><td colspan='6' class='small'>กำลังโหลด...</td></tr>";

  let snap;
  try{
    snap = await db().collection("tasks").orderBy("createdAt","desc").limit(100).get();
  }catch(_){
    snap = await db().collection("tasks").limit(100).get();
  }

  if(snap.empty){
    body.innerHTML = "<tr><td colspan='6' class='small'>ยังไม่มีงาน</td></tr>";
    return;
  }

  body.innerHTML = "";
  snap.forEach(doc=>{
    const t = doc.data();
    const active = t.active ? "Yes" : "No";
    body.insertAdjacentHTML("beforeend", `
      <tr>
        <td><b>${escapeHtml(t.title||"-")}</b><div class="small">${escapeHtml(t.description||"")}</div></td>
        <td>${escapeHtml(t.department||"-")}</td>
        <td>${escapeHtml(t.priority||"Normal")}</td>
        <td class="small">${escapeHtml(String(t.assignedTo||"-"))}</td>
        <td>${active}</td>
        <td>
          <div class="row" style="gap:8px;">
            <button class="secondary" onclick="toggleTask('${doc.id}', ${t.active ? "false":"true"})">${t.active ? "Disable":"Enable"}</button>
            <button class="secondary" onclick="editTask('${doc.id}')">Edit</button>
            <button class="danger" onclick="deleteTask('${doc.id}')">Delete</button>
          </div>
        </td>
      </tr>
    `);
  });
}

async function toggleTask(id, to){
  await db().collection("tasks").doc(id).update({active: !!to});
  toast("อัปเดตงานแล้ว ✅");
  await loadTaskList();
  await loadNotSubmittedReport();
  await loadStaffPoints();
}

async function editTask(id){
  const snap = await db().collection("tasks").doc(id).get();
  if(!snap.exists) return;
  const t = snap.data();
  const title = prompt("แก้ไขชื่องาน:", t.title || "");
  if(title === null) return;
  const desc = prompt("แก้ไขรายละเอียด:", t.description || "");
  if(desc === null) return;
  await db().collection("tasks").doc(id).update({title, description: desc});
  toast("แก้ไขงานแล้ว ✅");
  await loadTaskList();
  await loadNotSubmittedReport();
  await loadStaffPoints();
}

async function deleteTask(id){
  if(!requireManagerPin()){
    toast("PIN ไม่ถูกต้อง", "danger"); return;
  }
  if(!confirm("ลบงานนี้? (submission เก่าจะไม่ถูกลบ)")) return;
  await db().collection("tasks").doc(id).delete();
  toast("ลบงานแล้ว ✅");
  await loadTaskList();
  await loadNotSubmittedReport();
  await loadStaffPoints();
}

function onAssignModeChange(){
  const mode = el("assignMode").value;
  el("assignedToWrap").style.display = mode==="staffid" ? "block" : "none";
}

// ---------- Staff / Accounts ----------
async function createStaff(){
  const staffID = el("newStaffID").value.trim();
  const password = el("newStaffPassword").value;
  const name = el("newStaffName").value.trim();
  const position = el("newStaffPosition").value.trim() || "-";
  const department = el("newStaffDepartment").value.trim() || "-";
  const role = el("newStaffRole").value;

  if(!staffID || !password || !name){
    toast("กรุณากรอก StaffID / Password / Name", "danger");
    return;
  }

  await initFirebase();
  const cfg = window.__FIREBASE_CONFIG__;
  const secondaryName = "SecondaryCreateUser";
  let secondary = firebase.apps.find(a => a.name === secondaryName);
  if(!secondary) secondary = firebase.initializeApp(cfg, secondaryName);

  const secAuth = secondary.auth();

  try{
    const email = staffIdToEmail(staffID);
    const cred = await secAuth.createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;

    await db().collection("staff").doc(uid).set({
      staffID, name, position, department,
      role: role || "staff",
      points: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    toast("สร้างบัญชีพนักงานแล้ว ✅");

    el("newStaffID").value="";
    el("newStaffPassword").value="";
    el("newStaffName").value="";
    el("newStaffPosition").value="";
    el("newStaffDepartment").value="";
    el("newStaffRole").value="staff";

    await loadNotSubmittedReport();
  }catch(e){
    console.error(e);
    toast("สร้างบัญชีไม่สำเร็จ: " + (e?.message||e), "danger");
  }finally{
    try{ await secAuth.signOut(); }catch(_){}
  }
}


// =====================
// Staff Points
// =====================
async function loadStaffPoints(){
  const body = el("pointsRows");
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

    if(rows.length === 0){
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
