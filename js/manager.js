

const PRESET_DAILY_TASKS = {
  // Loaded from Daily Job Assighnment.xlsx (embedded in this build)
  Breakfast: [
  "Prepare Coffee Mug & Spoon",
  "Clean Trays & Trolleys",
  "Clean Salt & Pepper Shaker",
  "Clear Bin & Clean Station",
  "Prepare Tissue & Toothpick",
  "Clean Table Wipes (Rag)",
  "Prepare Pocket Spoon",
  "Carry Pot Coffee & Thermos",
  "Clean Baby Chairs",
  "Clean Coffee Machine",
  "Check Cushion / Pillow",
  "Clean Station Coffee",
  "Refill Sugar Bowl",
  "Cleanliness Front Restaurant Area",
  "Prepare Cutlery",
  "Prepare & Change Astray",
  "Lay Out Tables & Chairs",
  "Clean Tables & Chairs",
  "Clean Back Area",
  "Clean Menu"
],
  LunchDinner: [
  "Menu & Drink List",
  "Clean Tidy Station Service",
  "Prepare & Change Astray",
  "Clean Cutlery",
  "Table Booking",
  "Clean & Tidy FB Storage Room",
  "Sofa Area / Station Host / Outside",
  "Counting Nipkin & Record",
  "Prepare Station Service",
  "Clean Baby Chairs",
  "Prepare Cutlery",
  "Clean Table Cloth",
  "Salt & Pepper Shaker",
  "Clean Bin & Clean Station Clear",
  "Prepare Set Up Nipkin",
  "Clean Tidy Jack Tray & Troley",
  "Glass Were (Water)",
  "Clean Coffee Machine Station",
  "Tissue Glass & Thoothspick",
  "Prepare Cutlery Breakfast",
  "Clean Table & Chair",
  "Set up Coffee & Tea Station",
  "Pocket Spoon Buffet Line",
  "Folding Tissue Nipkin",
  "Prepare Food Runner",
  "Check Cleanliness Restaurant Area"
]
};

function slugId(s){
  return String(s||"")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_\-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
  if (el("showApprovedChk")) {
    el("showApprovedChk").checked = false; // default: hide approved
    el("showApprovedChk").addEventListener("change", async () => {
      await loadSubmissions();
    });
  }
  el("filterBtn").onclick = async ()=>{
    await loadSubmissions();
    await loadNotSubmittedReport();
  };
  el("cleanupBtn").onclick = cleanupOld;
  el("createStaffBtn").onclick = createStaff;
  el("createTaskBtn").onclick = createTask;
  el("assignMode").onchange = onAssignModeChange;
  el("reportBtn").onclick = loadNotSubmittedReport;
  if (el("toggleReportBtn")) el("toggleReportBtn").onclick = toggleReportPanel;
  if (el("toggleSetupBtn")) el("toggleSetupBtn").onclick = toggleSetupPanel;
  // default collapse: report + points
  if (el("reportPanel")) el("reportPanel").style.display = "none";
  if (el("toggleReportBtn")) el("toggleReportBtn").textContent = "Show report";
  if (el("pointsPanel")) el("pointsPanel").style.display = "none";
  if (el("togglePointsBtn")) el("togglePointsBtn").textContent = "Show points";
  if (el("checklistBtn")) el("checklistBtn").onclick = () => window.location.href = "checklist.html";
  if (el("refreshPointsBtn")) el("refreshPointsBtn").onclick = loadStaffPoints;
  if (el("togglePointsBtn")) el("togglePointsBtn").onclick = togglePointsPanel;
  // default: hide points list (too long)
  if (el("pointsPanel")) el("pointsPanel").style.display = "none";
  if (el("togglePointsBtn")) el("togglePointsBtn").textContent = "Show points";

  await loadSubmissions();
  await loadTaskList();
  await loadNotSubmittedReport();
  // points list loads only when expanded
  // await loadStaffPoints();
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
  body.innerHTML = "<tr><td colspan='7' class='small'>กำลังโหลด...</td></tr>";

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
    body.innerHTML = "<tr><td colspan='7' class='small'>ยังไม่มีการส่งงานในวันที่เลือก</td></tr>";
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

  const showApproved = !!(el("showApprovedChk") && el("showApprovedChk").checked);

  body.innerHTML = "";
  snap.forEach(doc=>{
    const s = doc.data();
    const st = (s.status || "waiting");
    if (!showApproved && st === "approved") {
      return; // hide approved rows
    }
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
</tr>
    `);
  });

  if (!body.innerHTML.trim()) {
    body.innerHTML = "<tr><td colspan='7' class='small'>✅ วันนี้ไม่มีรายการที่ต้องตรวจ (อาจถูก Approve แล้วทั้งหมด) — ถ้าต้องการดู ให้ติ๊ก 'Show approved'</td></tr>";
  }
  await loadKpi(date);
}

async function setStatus(id, status){
  try{
    const user = await requireAuth();
    const subRef = db().collection("submissions").doc(id);

    await db().runTransaction(async (tx) => {
      // ✅ READS FIRST (Firestore transactions require all reads before all writes)
      const subSnap = await tx.get(subRef);
      if (!subSnap.exists) throw new Error("Submission not found");

      const data = subSnap.data() || {};
      const alreadyAwarded = !!data.pointsAwarded;
      const staffUid = data.staffUid;

      const shouldAward = (status === "approved" && staffUid && !alreadyAwarded);

      // Points by task priority: Normal=1, High=2, Critical=3
      let pointsToAdd = 0;
      if (shouldAward) {
        pointsToAdd = 1;

        if (data.taskId) {
          const taskRef = db().collection("tasks").doc(String(data.taskId));
          const taskSnap = await tx.get(taskRef); // read before writes
          if (taskSnap.exists) {
            const t = taskSnap.data() || {};
            const p = String(t.priority || "Normal").toLowerCase();
            if (p === "high") pointsToAdd = 2;
            else if (p === "critical") pointsToAdd = 3;
            else pointsToAdd = 1;
          }
        }
      }

      // ✅ WRITES AFTER READS
      const updateData = {
        status,
        reviewerUid: user.uid,
        reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (shouldAward) {
        updateData.pointsAwarded = true;
        updateData.pointsAwardedValue = pointsToAdd;
      }

      tx.update(subRef, updateData);

      if (shouldAward) {
        const staffRef = db().collection("staff").doc(staffUid);
        tx.set(staffRef, { points: firebase.firestore.FieldValue.increment(pointsToAdd) }, { merge: true });
      }
    });

    toast("อัปเดตสถานะแล้ว ✅");
    await loadSubmissions();
    await loadNotSubmittedReport();
    // points list loads only when expanded
  // await loadStaffPoints();
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
    const st = (s.status || "waiting");
    if (!showApproved && st === "approved") {
      return; // hide approved rows
    }
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
  const tasks = taskSnap.docs.map(d=>({id:d.id, ...d.data()}))
    .filter(t => !t.forDate || t.forDate === date);

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

  const showApproved = !!(el("showApprovedChk") && el("showApprovedChk").checked);

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

  const showApproved = !!(el("showApprovedChk") && el("showApprovedChk").checked);

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
  // points list loads only when expanded
  // await loadStaffPoints();
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
  // points list loads only when expanded
  // await loadStaffPoints();
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
  // points list loads only when expanded
  // await loadStaffPoints();
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

    const showApproved = !!(el("showApprovedChk") && el("showApprovedChk").checked);

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


function togglePointsPanel(){
  const panel = el("pointsPanel");
  const btn = el("togglePointsBtn");
  if(!panel || !btn) return;

  const hidden = panel.style.display === "none" || panel.style.display === "";
  if(hidden){
    panel.style.display = "block";
    btn.textContent = "Hide points";
    loadStaffPoints();
  }else{
    panel.style.display = "none";
    btn.textContent = "Show points";
  }
}


function toggleReportPanel(){
  const panel = el("reportPanel");
  const btn = el("toggleReportBtn");
  if(!panel || !btn) return;

  const hidden = panel.style.display === "none" || panel.style.display === "";
  if(hidden){
    panel.style.display = "block";
    btn.textContent = "Hide report";
  }else{
    panel.style.display = "none";
    btn.textContent = "Show report";
  }
}

function toggleSetupPanel(){
  const panel = el("setupPanel");
  const btn = el("toggleSetupBtn");
  if(!panel || !btn) return;

  const hidden = panel.style.display === "none";
  if(hidden){
    panel.style.display = "block";
    btn.textContent = "Hide tools";
  }else{
    panel.style.display = "none";
    btn.textContent = "Show tools";
  }
}


async function seedTaskLibrary(){
  try{
    const depts = ["The Taste", "The Mangrove"];
    const periods = ["Breakfast", "LunchDinner"];

    const batch = db().batch();
    let writes = 0;

    for(const dept of depts){
      for(const period of periods){
        const titles = PRESET_DAILY_TASKS[period] || [];
        for(const title of titles){
          const docId = slugId(`${dept}_${period}_${title}`);
          const ref = db().collection("task_templates").doc(docId);
          batch.set(ref, {
            title,
            description: "",
            department: dept,
            period,
            priority: "Normal",
            active: true,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          writes++;
        }
      }
    }

    if(writes === 0){
      toast("ไม่มี task template ใน preset", "danger");
      return;
    }

    await batch.commit();
    toast(`Seed library สำเร็จ ✅ (${writes} tasks)`);
    await loadTaskTemplatesToSelect();
    await updateRandInfo();
  }catch(e){
    console.error(e);
    toast("Seed library ไม่สำเร็จ: " + (e?.message||e), "danger");
  }
}

async function loadTaskTemplatesToSelect(){
  const sel = el("taskTemplateSelect");
  if(!sel) return;

  const dept = el("taskDept")?.value?.trim() || el("randDept")?.value || "The Taste";

  // Load templates for selected department (all periods)
  const snap = await db().collection("task_templates")
    .where("department","==",dept)
    .where("active","==",true)
    .get();

  const list = snap.docs.map(d=>({id:d.id, ...d.data()}))
    .sort((a,b)=> String(a.period||"").localeCompare(String(b.period||"")) || String(a.title||"").localeCompare(String(b.title||"")));

  sel.innerHTML = `<option value="">— Select from library —</option>`;
  for(const t of list){
    const label = `${t.title} ${t.period ? "(" + t.period + ")" : ""}`;
    sel.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(t.id)}">${escapeHtml(label)}</option>`);
  }
}

async function applySelectedTemplate(){
  const sel = el("taskTemplateSelect");
  if(!sel || !sel.value) return;

  try{
    const snap = await db().collection("task_templates").doc(sel.value).get();
    if(!snap.exists) return;
    const t = snap.data() || {};
    if (el("taskTitle")) el("taskTitle").value = t.title || "";
    if (el("taskDescription")) el("taskDescription").value = t.description || "";
    if (el("taskDept")) el("taskDept").value = t.department || "";
    if (el("taskPriority")) el("taskPriority").value = t.priority || "Normal";
  }catch(e){
    console.error(e);
    toast("เลือก template ไม่สำเร็จ: " + (e?.message||e), "danger");
  }
}

async function updateRandInfo(){
  try{
    const dept = el("randDept")?.value || "The Taste";
    const period = el("randPeriod")?.value || "All";

    // staff count
    const staffSnap = await db().collection("staff").where("department","==",dept).limit(500).get();
    const staff = staffSnap.docs.map(d=>({uid:d.id, ...d.data()})).filter(s => (s.role || "staff") !== "manager");
    const staffCount = staff.length;

    // template count
    let q = db().collection("task_templates").where("department","==",dept).where("active","==",true);
    if(period !== "All") q = q.where("period","==",period);
    const tplSnap = await q.get();
    const taskCount = tplSnap.size;

    if(el("randInfo")) el("randInfo").value = `${staffCount} staff / ${taskCount} tasks`;
  }catch(e){
    console.error(e);
  }
}

async function clearAutoJobs(){
  const dept = el("randDept")?.value || "The Taste";
  const date = el("randDate")?.value || todayStr();
  try{
    // find auto-generated tasks for this date+dept
    const snap = await db().collection("tasks")
      .where("autoGenerated","==",true)
      .where("department","==",dept)
      .where("forDate","==",date)
      .get();

    if(snap.empty){
      toast("ไม่พบงาน auto สำหรับวัน/แผนกนี้", "info");
      return;
    }

    const batch = db().batch();
    snap.docs.forEach(d=> batch.update(d.ref, { active:false, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }));
    await batch.commit();

    toast(`ปิดงาน auto แล้ว ✅ (${snap.size} tasks)`);
    await loadTaskList();
    await loadNotSubmittedReport();
  }catch(e){
    console.error(e);
    toast("Clear auto jobs ไม่สำเร็จ: " + (e?.message||e), "danger");
  }
}

async function randomAssignDailyJobs(){
  const dept = el("randDept")?.value || "The Taste";
  const period = el("randPeriod")?.value || "All";
  const date = el("randDate")?.value || todayStr();

  try{
    // load staff in department
    const staffSnap = await db().collection("staff").where("department","==",dept).limit(500).get();
    const staff = staffSnap.docs.map(d=>({uid:d.id, ...d.data()})).filter(s => (s.role || "staff") !== "manager");

    if(!staff.length){
      toast("ไม่พบพนักงานใน Department นี้", "danger");
      return;
    }

    // load templates
    let q = db().collection("task_templates").where("department","==",dept).where("active","==",true);
    if(period !== "All") q = q.where("period","==",period);
    const tplSnap = await q.get();
    const templates = tplSnap.docs.map(d=>({id:d.id, ...d.data()}));

    if(!templates.length){
      toast("ยังไม่มีงานใน Library (กด Seed library ก่อน)", "danger");
      return;
    }

    // disable old auto tasks for same date+dept to avoid duplicates
    await clearAutoJobs(); // will set active:false if found (safe)
    
    const staffShuffled = shuffle(staff);
    const tasksShuffled = shuffle(templates);

    // แจกให้ครบคนก่อน แล้วค่อยวนซ้ำ (round-robin แบบเป็นรอบ)
    // รอบที่ 1: ทุกคนได้งานละ 1 (ถ้างานพอ)
    // รอบที่ 2: แจกซ้ำรอบใหม่ตามลำดับเดิม
    const batch = db().batch();
    let staffIdx = 0;
    let round = 1;
    for(const t of tasksShuffled){
      const assignee = staffShuffled[staffIdx];
      const ref = db().collection("tasks").doc(); // new
      batch.set(ref, {
        title: t.title || "",
        description: t.description || "",
        department: dept,
        priority: t.priority || "Normal",
        assignedTo: assignee.uid, // staff uid
        active: true,
        forDate: date,
        period: t.period || "",
        autoGenerated: true,
        templateId: t.id,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      staffIdx++;
      if (staffIdx >= staffShuffled.length) {
        staffIdx = 0;
        round++;
      }
    }
    await batch.commit();

    toast(`สุ่มแจกงานสำเร็จ ✅ (${tasksShuffled.length} tasks / ${staffShuffled.length} staff)`);
    await loadTaskList();
    await loadNotSubmittedReport();
  }catch(e){
    console.error(e);
    toast("สุ่มแจกงานไม่สำเร็จ: " + (e?.message||e), "danger");
  }
}


function addDays(dateStr, deltaDays){
  const [y,m,d] = String(dateStr||"").split("-").map(x=>parseInt(x,10));
  const dt = new Date(y, (m||1)-1, d||1);
  dt.setDate(dt.getDate() + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth()+1).padStart(2,"0");
  const dd = String(dt.getDate()).padStart(2,"0");
  return `${yy}-${mm}-${dd}`;
}


async function copyYesterdayAssignments(){
  const dept = el("randDept")?.value || "The Taste";
  const date = el("randDate")?.value || todayStr();
  const yday = addDays(date, -1);

  try{
    const snap = await db().collection("tasks")
      .where("department","==",dept)
      .where("forDate","==",yday)
      .get();

    const yesterdayTasks = snap.docs.map(d=>({id:d.id, ...d.data()}))
      .filter(t => t.active !== false);

    if(!yesterdayTasks.length){
      toast(`ไม่พบงานของเมื่อวาน (${yday}) ในแผนก ${dept}`, "danger");
      return;
    }

    // Disable existing auto/copy tasks for target date+dept to avoid duplicates
    const todaySnap = await db().collection("tasks")
      .where("department","==",dept)
      .where("forDate","==",date)
      .get();

    const existing = todaySnap.docs.filter(d=> {
      const t = d.data() || {};
      return t.autoGenerated === true || t.copiedFromDate;
    });

    if(existing.length){
      const ok = confirm(`พบงาน (auto/copy) ของวันที่ ${date} จำนวน ${existing.length} งาน\nต้องการปิดของเดิมแล้วค่อยคัดลอกใหม่ไหม?`);
      if(!ok) return;
      const batch0 = db().batch();
      existing.forEach(d=> batch0.update(d.ref, { active:false, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }));
      await batch0.commit();
    }

    const batch = db().batch();
    let count = 0;

    for(const t of yesterdayTasks){
      const ref = db().collection("tasks").doc();
      batch.set(ref, {
        title: t.title || "",
        description: t.description || "",
        department: dept,
        priority: t.priority || "Normal",
        assignedTo: t.assignedTo || "all",
        active: true,
        forDate: date,
        period: t.period || "",
        autoGenerated: true,
        copiedFromDate: yday,
        copiedFromTaskId: t.id,
        templateId: t.templateId || "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      count++;
    }

    await batch.commit();
    toast(`คัดลอกงานเมื่อวาน → วันนี้ สำเร็จ ✅ (${count} tasks)`);
    await loadTaskList();
    await loadNotSubmittedReport();
  }catch(e){
    console.error(e);
    toast("Copy yesterday ไม่สำเร็จ: " + (e?.message||e), "danger");
  }
}
