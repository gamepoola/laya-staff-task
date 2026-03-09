async function loadUploadPage(){
  const user = await requireAuth();
  const taskId = qs("taskId");

  if(!taskId){
    toast("ไม่พบ taskId", "danger");
    window.location.href="staff.html";
    return;
  
  // show selected file count
  const photoInput = el("photo");
  if (photoInput && el("fileCount")) {
    photoInput.addEventListener("change", () => {
      const n = photoInput.files ? photoInput.files.length : 0;
      el("fileCount").textContent = n ? `Selected: ${n} photo(s)` : "";
    });
  }
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

  const fileInput = el("photo");
  if (fileInput) {
    fileInput.addEventListener("change", async () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      const mb = (f.size/1024/1024).toFixed(2);
      toast(`เลือกไฟล์แล้ว (${mb} MB) — ระบบจะบีบอัดให้อัตโนมัติก่อนอัปโหลด`, "info");
    });
  }

  el("backBtn").onclick = ()=> window.location.href="staff.html";
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

async function submitWork(){
  const user = await requireAuth();
  const profile = await getProfile(user.uid);
  const taskId = qs("taskId");
  const files = Array.from(el("photo").files || []);

  if(!files.length){
    toast("กรุณาเลือกรูปก่อนส่งงาน", "danger");
    return;
  }

  // safety limit
  if (files.length > 10) {
    toast("เลือกได้สูงสุด 10 รูปต่อครั้ง", "danger");
    return;
  }

  // HEIC hint
  const hasHeic = files.some(f => (f.name||"").toLowerCase().endsWith(".heic") || (f.name||"").toLowerCase().endsWith(".heif"));
  if (hasHeic) {
    toast("มีไฟล์ HEIC/HEIF: ถ้าอัปโหลดไม่ได้ ให้ตั้งกล้อง iPhone เป็น 'Most Compatible (JPEG)'", "danger");
  }

  try{
    el("submitBtn").disabled = true;

    const today = todayStr();
    const ts = Date.now();

    const photoPaths = [];
    const photoURLs = [];
    const originalSizesBytes = [];
    const uploadedSizesBytes = [];

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

    el("submitBtn").textContent = "Saving...";

    await db().collection("submissions").add({
      taskId,
      staffUid: user.uid,
      staffID: profile?.staffID || "",
      staffName: profile?.name || "",
      department: profile?.department || "",
      date: today,

      // NEW: multiple photos
      photoPaths,
      photoURLs,
      photosCount: photoURLs.length,

      // Backward compatible (first photo)
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

    toast(`ส่งงานสำเร็จ ✅ (${photoURLs.length} รูป)` , "info");
    setTimeout(()=> window.location.href="staff.html", 800);
  }catch(e){
    console.error(e);
    toast("ส่งงานไม่สำเร็จ: " + (e?.message||e), "danger");
    el("submitBtn").disabled = false;
    el("submitBtn").textContent = "Submit";
  }
}

