async function doLogin(){
  await initFirebase();
  const staffID = el("staffID").value.trim();
  const password = el("password").value;

  if(!staffID || !password){
    toast("กรุณากรอก Staff ID และ Password", "danger");
    return;
  }

  const email = staffIdToEmail(staffID);

  try{
    await auth().signInWithEmailAndPassword(email, password);

    const user = auth().currentUser;
    const profile = await getProfile(user.uid);

    if(profile?.role === "manager"){
      window.location.href = "manager.html";
    }else{
      window.location.href = "staff.html";
    }
  }catch(e){
    console.error(e);
    toast("Login ไม่สำเร็จ: " + (e?.message || e), "danger");
  }
}

async function doLogout(){
  await initFirebase();
  await auth().signOut();
  window.location.href = "login.html";
}
