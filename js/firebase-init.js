// Firebase compat SDK (เหมาะกับ GitHub Pages / static hosting)
function loadScript(src){
  return new Promise((resolve, reject)=>{
    const s=document.createElement("script");
    s.src=src;
    s.onload=resolve;
    s.onerror=reject;
    document.head.appendChild(s);
  });
}

async function initFirebase(){
  const cfg = window.__FIREBASE_CONFIG__;
  if (!cfg || cfg.apiKey === "PASTE_HERE") {
    console.warn("Firebase config not set. Edit js/firebase-config.js");
  }
  if (window.firebase && firebase.apps && firebase.apps.length) return;

  const v = "10.12.5";
  await loadScript(`https://www.gstatic.com/firebasejs/${v}/firebase-app-compat.js`);
  await loadScript(`https://www.gstatic.com/firebasejs/${v}/firebase-auth-compat.js`);
  await loadScript(`https://www.gstatic.com/firebasejs/${v}/firebase-firestore-compat.js`);
  await loadScript(`https://www.gstatic.com/firebasejs/${v}/firebase-storage-compat.js`);

  firebase.initializeApp(cfg);
}

function auth(){ return firebase.auth(); }
function db(){ return firebase.firestore(); }
function storage(){ return firebase.storage(); }

function el(id){ return document.getElementById(id); }

function toast(msg, kind="info"){
  const box = document.createElement("div");
  box.className = "notice";
  box.style.position = "fixed";
  box.style.left = "20px";
  box.style.right = "20px";
  box.style.bottom = "20px";
  box.style.zIndex = "9999";
  box.style.maxWidth = "1100px";
  box.style.margin = "0 auto";
  box.style.borderColor = kind==="danger" ? "rgba(251,113,133,.35)" : "rgba(255,255,255,.12)";
  box.textContent = msg;
  document.body.appendChild(box);
  setTimeout(()=> box.remove(), 3200);
}

function staffIdToEmail(staffID){
  const dom = window.__STAFF_EMAIL_DOMAIN__ || "laya.local";
  const s = String(staffID || "").trim();
  if (!s) return "";
  if (s.includes("@")) return s;
  return `${s}@${dom}`;
}

function todayStr(d = new Date()){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const da = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${da}`;
}

function qs(name){
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

async function requireAuth(redirectTo="login.html"){
  await initFirebase();
  return new Promise((resolve)=>{
    const unsub = auth().onAuthStateChanged(user=>{
      unsub();
      if(!user){ window.location.href = redirectTo; return; }
      resolve(user);
    });
  });
}

async function getProfile(uid){
  const snap = await db().collection("staff").doc(uid).get();
  return snap.exists ? snap.data() : null;
}

function statusBadge(status){
  const s = status || "waiting";
  return `<span class="badge ${s}">${s}</span>`;
}

function requireManagerPin(){
  const pin = prompt("กรุณาใส่รหัสผู้จัดการ (PIN) เพื่อดำเนินการต่อ:");
  return pin === (window.__MANAGER_DELETE_PIN__ || "1234");
}
