const DAILY_SUBMISSION_LIMIT = 2;

async function getTodaySubmissionStats(uid, taskId = "") {
  const today = todayStr();
  const snap = await db().collection("submissions")
    .where("staffUid", "==", uid)
    .where("date", "==", today)
    .get();

  let total = 0;
  let taskAlreadySubmitted = false;

  snap.forEach(doc => {
    const data = doc.data() || {};
    total += 1;
    if (taskId && data.taskId === taskId) taskAlreadySubmitted = true;
  });

  return {
    today,
    total,
    remaining: Math.max(0, DAILY_SUBMISSION_LIMIT - total),
    taskAlreadySubmitted
  };
}

function updateQuotaLabel(stats) {
  const label = el("uploadQuotaLabel");
  if (!label || !stats) return;
  label.textContent = `${stats.total}/${DAILY_SUBMISSION_LIMIT} งาน (เหลือ ${stats.remaining})`;
}

function setSubmitLocked(text) {
  const btn = el("submitBtn");
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = text;
}

function setSubmitReady(text = "Submit") {
  const btn = el("submitBtn");
  if (!btn) return;
  btn.disabled = false;
  btn.textContent = text;
}

async function loadUploadPage(){
  const user = await requireAuth();
  const taskId = qs("taskId");

  if(!taskId){
    toast("ไม่พบ taskId", "danger");
    window.location.href = "staff.html";
    return;
  }

  const photoInput = el("photo");
  if (photoInput && el("fileCount")) {
    photoInput.addEventListener("change", () => {
      const n = photoInput.files ? photoInput.files.length : 0;
      el("fileCount").textContent = n ? `Selected: ${n} photo(s)` : "";
    });
  }

  const taskSnap = await db().collection("tasks").doc(taskId).get();
  if(!taskSnap.exists){
    toast("ไม่พบงานนี้ในระบบ", "danger");
    window.location.href = "staff.html";
    return;
  }

  const task = taskSnap.data() || {};
  el("taskTitle").textContent = task.title || "-";
  el("taskDesc").textContent = task.description || "";

  const stats = await getTodaySubmissionStats(user.uid, taskId);
  el("todayLabel").textContent = stats.today;
  updateQuotaLabel(stats);

  if(stats.taskAlreadySubmitted){
    setSubmitLocked("ส่งงานนี้แล้ววันนี้");
    toast("งานนี้ส่งแล้ววันนี้", "info");
  } else if (stats.total >= DAILY_SUBMISSION_LIMIT) {
    setSubmitLocked("ครบ 2 งานแล้ววันนี้");
    toast("วันนี้ส่งงานครบ 2 งานแล้ว", "danger");
  } else {
    setSubmitReady(`Submit (${stats.remaining} slot left)`);
  }

  if (photoInput) {
    photoInput.addEventListener("change", async () => {
      const f = photoInput.files && photoInput.files[0];
      if (!f) return;
      const mb = (f.size/1024/1024).toFixed(2);
      toast(`เลือกไฟล์แล้ว (${mb} MB) — ระบบจะบีบอัดให้อัตโนมัติก่อนอัปโหลด`, "info");
    });
  }

  el("backBtn").onclick = () => window.location.href = "staff.html";
}

// ---------- Image compression (client-side) ----------
// Goal: keep under ~2MB, max dimension 1600px
async function compressImageToJpeg(file, {
  targetMB = 2,
  maxDim = 1600,
  initialQuality = 0.85,
  minQuality = 0.55
} = {}) {
  const img = await loadImage(file);

  let width = img.width;
  let height = img.height;

  const scale = Math.min(1, maxDim / Math.max(width, height));
  const newW = Math.max(1, Math.round(width * scale));
  const newH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = newW;
  canvas.height = newH;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, newW, newH);

  let quality = initialQuality;
  let blob = await canvasToJpegBlob(canvas, quality);

  const targetBytes = targetMB * 1024 * 1024;

  let guard = 0;
  while (blob.size > targetBytes && quality > minQuality && guard < 8) {
    quality = Math.max(minQuality, quality - 0.07);
    blob = await canvasToJpegBlob(canvas, quality);
    guard++;
  }

  if (blob.size > targetBytes) {
    const shrinkSteps = [0.85, 0.75, 0.65];
    for (const s of shrinkSteps) {
      const w2 = Math.max(1, Math.round(newW * s));
      const h2 = Math.max(1, Math.round(newH * s));
      canvas.width = w2;
      canvas.height = h2;
      ctx.drawImage(img, 0, 0, w2, h2);
      blob = await canvasToJpegBlob(canvas, quality);
      if (blob.size <= targetBytes) break;
    }
  }

  return blob;
}

function canvasToJpegBlob(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    if (window.createImageBitmap) {
      createImageBitmap(file).then(resolve).catch(() => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
    } else {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    }
  });
}

async function deleteUploadedFiles(paths = []) {
  for (const path of paths) {
    if (!path) continue;
    try {
      await storage().ref().child(path).delete();
    } catch (_) {}
  }
}

async function submitWork(){
  const user = await requireAuth();
  const profile = await getProfile(user.uid);
  const taskId = qs("taskId");
  const files = Array.from(el("photo").files || []);

  if(!files.length){
    toast("กรุณาเลือกรูปก่อนส่งงาน", "danger");
    return;
  }

  if (files.length > 10) {
    toast("เลือกได้สูงสุด 10 รูปต่อครั้ง", "danger");
    return;
  }

  const hasHeic = files.some(f => (f.name||"").toLowerCase().endsWith(".heic") || (f.name||"").toLowerCase().endsWith(".heif"));
  if (hasHeic) {
    toast("มีไฟล์ HEIC/HEIF: ถ้าอัปโหลดไม่ได้ ให้ตั้งกล้อง iPhone เป็น 'Most Compatible (JPEG)'", "danger");
  }

  const precheck = await getTodaySubmissionStats(user.uid, taskId);
  updateQuotaLabel(precheck);

  if (precheck.taskAlreadySubmitted) {
    setSubmitLocked("ส่งงานนี้แล้ววันนี้");
    toast("งานนี้ส่งแล้ววันนี้", "info");
    return;
  }

  if (precheck.total >= DAILY_SUBMISSION_LIMIT) {
    setSubmitLocked("ครบ 2 งานแล้ววันนี้");
    toast("วันนี้ส่งงานครบ 2 งานแล้ว", "danger");
    return;
  }

  const today = precheck.today;
  const ts = Date.now();
  const submissionId = `${today}__${user.uid}__${taskId}`;

  const photoPaths = [];
  const photoURLs = [];
  const originalSizesBytes = [];
  const uploadedSizesBytes = [];

  try{
    setSubmitLocked("Preparing...");

    for(let i=0;i<files.length;i++){
      const file = files[i];
      originalSizesBytes.push(file.size);

      el("submitBtn").textContent = `Compressing ${i+1}/${files.length}...`;
      const compressedBlob = await compressImageToJpeg(file, { targetMB: 2, maxDim: 1600 });
      uploadedSizesBytes.push(compressedBlob.size);

      el("submitBtn").textContent = `Uploading ${i+1}/${files.length}...`;

      const safeBase = (file.name || "photo")
        .replaceAll(/[^a-zA-Z0-9._-]/g,"_")
        .replace(/\.(heic|heif|png|jpg|jpeg|webp)$/i,"");
      const outName = `${safeBase || "photo"}_${ts}_${i+1}.jpg`;
      const path = `submissions/${today}/${user.uid}/${taskId}/${outName}`;

      const ref = storage().ref().child(path);
      await ref.put(compressedBlob);
      const url = await ref.getDownloadURL();

      photoPaths.push(path);
      photoURLs.push(url);
    }

    const finalCheck = await getTodaySubmissionStats(user.uid, taskId);
    updateQuotaLabel(finalCheck);

    if (finalCheck.taskAlreadySubmitted || finalCheck.total >= DAILY_SUBMISSION_LIMIT) {
      await deleteUploadedFiles(photoPaths);
      if (finalCheck.taskAlreadySubmitted) {
        setSubmitLocked("ส่งงานนี้แล้ววันนี้");
        throw new Error("งานนี้ถูกส่งไปแล้ววันนี้");
      }
      setSubmitLocked("ครบ 2 งานแล้ววันนี้");
      throw new Error("วันนี้ส่งงานครบ 2 งานแล้ว");
    }

    el("submitBtn").textContent = "Saving...";

    await db().collection("submissions").doc(submissionId).set({
      taskId,
      staffUid: user.uid,
      staffID: profile?.staffID || "",
      staffName: profile?.name || "",
      department: profile?.department || "",
      date: today,

      photoPaths,
      photoURLs,
      photosCount: photoURLs.length,

      photoPath: photoPaths[0] || "",
      photoURL: photoURLs[0] || "",

      status: "waiting",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),

      originalSizesBytes,
      uploadedSizesBytes,
      originalTotalBytes: originalSizesBytes.reduce((a,b)=>a+b,0),
      uploadedTotalBytes: uploadedSizesBytes.reduce((a,b)=>a+b,0)
    });

    const afterSave = await getTodaySubmissionStats(user.uid, taskId);
    updateQuotaLabel(afterSave);

    toast(`ส่งงานสำเร็จ ✅ (${photoURLs.length} รูป)` , "info");
    setTimeout(() => window.location.href = "staff.html", 800);
  }catch(e){
    console.error(e);
    if (String(e?.message || "").toLowerCase().includes("permission")) {
      toast("ส่งงานไม่สำเร็จ: งานนี้อาจถูกส่งแล้ว หรือไม่มีสิทธิ์เขียนข้อมูล", "danger");
    } else {
      toast("ส่งงานไม่สำเร็จ: " + (e?.message||e), "danger");
    }

    const latest = await getTodaySubmissionStats(user.uid, taskId).catch(() => null);
    if (latest) {
      updateQuotaLabel(latest);
      if (latest.taskAlreadySubmitted) setSubmitLocked("ส่งงานนี้แล้ววันนี้");
      else if (latest.total >= DAILY_SUBMISSION_LIMIT) setSubmitLocked("ครบ 2 งานแล้ววันนี้");
      else setSubmitReady(`Submit (${latest.remaining} slot left)`);
    } else {
      setSubmitReady("Submit");
    }
  }
}
