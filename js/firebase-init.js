import { FirebaseError, initializeApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  setPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import {
  getFunctions,
  connectFunctionsEmulator,
  httpsCallable,
} from "firebase/functions";
import {
  getStorage,
  connectStorageEmulator,
  ref,
  uploadBytesResumable,
  getBlob,
  getMetadata,
} from "firebase/storage";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";
const c = window.LAYA_CONFIG;
if (!c?.firebase?.projectId) throw Error("Missing configuration");
const local = ["localhost", "127.0.0.1"].includes(location.hostname);
if (
  c.environment === "staging" &&
  (!/^laya-[a-z0-9-]+-staging$/.test(c.firebase.projectId) ||
    !c.firebase.storageBucket?.startsWith(c.firebase.projectId + ".") ||
    c.firebase.authDomain !== c.firebase.projectId + ".firebaseapp.com")
)
  throw Error("Staging configuration cannot connect to another project");
if (
  c.environment === "emulator" &&
  (!local || !c.firebase.projectId.startsWith("demo-"))
)
  throw Error(
    "Emulator configuration may only run on localhost with a demo project",
  );
const app = initializeApp(c.firebase);
export const auth = getAuth(app),
  functions = getFunctions(app, c.region || "us-central1"),
  storage = getStorage(app);
if (c.environment === "emulator") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
} else if (c.appCheckSiteKey)
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(c.appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
export const ready = setPersistence(auth, browserSessionPersistence);
export async function currentUser() {
  await ready;
  return new Promise((resolve) => {
    const un = onAuthStateChanged(auth, (u) => {
      un();
      resolve(u);
    });
  });
}
export async function api(name, data = {}) {
  if (!navigator.onLine)
    throw Error("ออฟไลน์ — ยังไม่ได้บันทึกบน server / Offline");
  return (await httpsCallable(functions, name, { timeout: 120000 })(data)).data;
}
export async function login(staffID, password) {
  await ready;
  const email = staffID.includes("@")
    ? staffID.trim().toLowerCase()
    : staffID.trim().toLowerCase() + "@laya.local";
  return signInWithEmailAndPassword(auth, email, password);
}
export function validStaffPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 6 &&
    password.length <= 9 &&
    !!password.trim()
  );
}
export async function register(staffID, password, name) {
  await ready;
  const id = staffID.trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,40}$/.test(id))
    throw Error("รหัสพนักงานใช้ a-z, 0-9, _ และ - ไม่เกิน 40 ตัว");
  if (!validStaffPassword(password))
    throw new FirebaseError("app/staff-password-length", "Use 6–9 characters");
  try {
    try {
      await createUserWithEmailAndPassword(auth, id + "@laya.local", password);
    } catch (e) {
      if (e.code !== "auth/email-already-in-use") throw e;
      try {
        await signInWithEmailAndPassword(auth, id + "@laya.local", password);
      } catch (signInError) {
        if (
          !["auth/invalid-credential", "auth/wrong-password"].includes(
            signInError.code,
          )
        )
          throw signInError;
        throw new FirebaseError(
          "app/staff-account-exists",
          "Staff ID already registered",
        );
      }
    }
    return await api("registerStaff", { name });
  } finally {
    await signOut(auth);
  }
}
export async function logout() {
  await signOut(auth);
  sessionStorage.clear();
  location.href = "login.html";
}
export async function photoBlob(path) {
  return getBlob(ref(storage, path), 2 * 1024 * 1024);
}
export async function upload(path, blob, progress) {
  const r = ref(storage, path);
  try {
    const m = await getMetadata(r);
    if (m.size === blob.size) return;
  } catch (e) {
    if (e.code !== "storage/object-not-found") throw e;
  }
  await new Promise((resolve, reject) => {
    const task = uploadBytesResumable(r, blob, {
      contentType: "image/jpeg",
      cacheControl: "private, no-store",
    });
    task.on(
      "state_changed",
      (s) => progress(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
      reject,
      resolve,
    );
  });
}
