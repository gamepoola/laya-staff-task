// Login + First-time password setup (self registration)
// Flow:
// - Staff enters StaffID + Password
// - If account exists -> sign in
// - If account does not exist -> create account with that password (first-time setup)
//   then create profile in Firestore from staff_directory/{staffID}

async function doLogin(){
  await initFirebase();

  const staffIDRaw = el("staffID").value.trim();
  const password = el("password").value;

  if(!staffIDRaw || !password){
    toast("กรุณากรอก Staff ID และ Password", "danger");
    return;
  }

  const staffID = String(staffIDRaw).trim();
  const email = staffIdToEmail(staffID);

  try{
    await auth().signInWithEmailAndPassword(email, password);

    const user = auth().currentUser;

    // If profile missing (e.g., migrated), bootstrap from directory
    let profile = await getProfile(user.uid);
    if(!profile){
      try{
        profile = await bootstrapProfileFromDirectory(staffID, user.uid);
      }catch(err){
        try{ await auth().signOut(); }catch(_){ }
        throw err;
      }
    }

    if(profile?.role === "manager"){
      window.location.href = "manager.html";
    }else{
      window.location.href = "staff.html";
    }
  }catch(e){
    console.error(e);

    // Decide whether this is first-time setup or wrong password
    try{
      const methods = await auth().fetchSignInMethodsForEmail(email);
      if(!methods || methods.length === 0){
        // First-time: create account with this password
        await firstTimeRegister(staffID, password);
        return;
      }
      // account exists -> wrong password
      toast("Login ไม่สำเร็จ: รหัสผ่านไม่ถูกต้อง", "danger");
      return;
    }catch(_){
      // Fallback
      const msg = e?.message || String(e);
      toast("Login ไม่สำเร็จ: " + msg, "danger");
    }
  }
}

async function firstTimeRegister(staffID, password){
  await initFirebase();

  const email = staffIdToEmail(staffID);

  if(String(password).length < 6){
    toast("ตั้งรหัสผ่านอย่างน้อย 6 ตัวอักษร", "danger");
    return;
  }

  try{
    toast("ไม่พบบัญชีเดิม — กำลังตั้งรหัสครั้งแรก...", "info");

    const cred = await auth().createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;

    // Create profile from staff_directory
    let profile;
    try{
      profile = await bootstrapProfileFromDirectory(staffID, uid);
    }catch(err){
      // rollback auth user if profile bootstrap failed
      try{ const u = auth().currentUser; if(u) await u.delete(); }catch(_){ }
      try{ await auth().signOut(); }catch(_){ }
      throw err;
    }

    toast("ตั้งรหัสครั้งแรกสำเร็จ ✅", "info");

    if(profile?.role === "manager"){
      window.location.href = "manager.html";
    }else{
      window.location.href = "staff.html";
    }
  }catch(e){
    console.error(e);
    toast("ตั้งรหัสครั้งแรกไม่สำเร็จ: " + (e?.message || e), "danger");
  }
}

async function bootstrapProfileFromDirectory(staffID, uid){
  // Must be signed in at this point
  const sid = String(staffID).trim();
  const dirRef = db().collection("staff_directory").doc(sid);

  const snap = await dirRef.get();
  if(!snap.exists){
    // If just created user but ID not in directory, delete account to prevent orphan users
    try{
      const u = auth().currentUser;
      if(u && u.uid === uid){
        await u.delete();
      }
    }catch(_){}
    try{ await auth().signOut(); }catch(_){}
    throw new Error("ไม่พบ Staff ID นี้ในรายชื่อ (ให้ Manager import รายชื่อจาก Excel ก่อน)");
  }

  const d = snap.data() || {};
  if(d.active === false){
    throw new Error("Staff ID นี้ถูกปิดใช้งาน (inactive)");
  }

  const staffRef = db().collection("staff").doc(uid);
  const staffSnap = await staffRef.get();
  if (staffSnap.exists) {
    return staffSnap.data();
  }

  const role = String(d.role || "staff").toLowerCase() === "manager" ? "manager" : "staff";

  const profile = {
    staffID: sid,
    name: d.name || "",
    nickName: d.nickName || d.nickname || "",
    position: d.position || "-",
    department: d.department || "-",
    role,
    points: 0,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  // Create profile document staff/{uid}
  await staffRef.set(profile, { merge: false });

  return profile;
}

async function doLogout(){
  await initFirebase();
  await auth().signOut();
  window.location.href = "login.html";
}
