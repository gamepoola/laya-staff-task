async function loadUploadPage(){
  const user = await requireAuth();
  const taskId = qs("taskId");

  if(!taskId){
    toast("ไม่พบ taskId", "danger");
    window.location.href="staff.html";
    return;
  }

  const taskSnap = await db().collection("tasks").doc(taskId).get();
  if(!taskSnap.exists){
    toast("ไม่พบงานนี้ในระบบ", "danger");
    window.location.href="staff.html";
    return;
  }
  const task = taskSnap.data();
  el("taskTitle").textContent = task.title || "-";
  el("taskDesc").textContent = task.description || "";
  el("todayLabel").textContent = todayStr();

  const today = todayStr();
  const existing = await db().collection("submissions")
    .where("staffUid","==",user.uid)
    .where("taskId","==",taskId)
    .where("date","==",today)
    .limit(1).get();

  if(!existing.empty){
    el("submitBtn").disabled = true;
    el("submitBtn").textContent = "ส่งแล้ววันนี้";
    toast("งานนี้ส่งแล้ววันนี้", "info");
  }

  el("backBtn").onclick = ()=> window.location.href="staff.html";
}

async function submitWork(){
  const user = await requireAuth();
  const profile = await getProfile(user.uid);
  const taskId = qs("taskId");
  const file = el("photo").files[0];

  if(!file){
    toast("กรุณาเลือกรูปก่อนส่งงาน", "danger");
    return;
  }

  const maxMB = 10;
  if(file.size > maxMB*1024*1024){
    toast(`ไฟล์ใหญ่เกินไป (สูงสุด ${maxMB} MB)`, "danger");
    return;
  }

  const today = todayStr();
  const ts = Date.now();
  const safeName = (file.name || "photo").replaceAll(/[^a-zA-Z0-9._-]/g,"_");
  const path = `submissions/${today}/${user.uid}/${taskId}/${ts}_${safeName}`;

  try{
    el("submitBtn").disabled = true;
    el("submitBtn").textContent = "กำลังอัปโหลด...";

    const ref = storage().ref().child(path);
    await ref.put(file);
    const url = await ref.getDownloadURL();

    await db().collection("submissions").add({
      taskId,
      staffUid: user.uid,
      staffID: profile?.staffID || "",
      staffName: profile?.name || "",
      department: profile?.department || "",
      date: today,
      photoPath: path,
      photoURL: url,
      status: "waiting",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    toast("ส่งงานสำเร็จ ✅", "info");
    setTimeout(()=> window.location.href="staff.html", 800);
  }catch(e){
    console.error(e);
    toast("ส่งงานไม่สำเร็จ: " + (e?.message||e), "danger");
    el("submitBtn").disabled = false;
    el("submitBtn").textContent = "Submit";
  }
}
