// ✅ ใส่ Firebase config ของคุณ (Firebase Console → Project settings → Your apps → Web app config)
window.__FIREBASE_CONFIG__ = {
  apiKey: "PASTE_HERE",
  authDomain: "PASTE_HERE",
  projectId: "PASTE_HERE",
  storageBucket: "PASTE_HERE",
  messagingSenderId: "PASTE_HERE",
  appId: "PASTE_HERE"
};

// ระบบนี้จะ login ด้วย Email/Password โดย "แปลง StaffID เป็นอีเมล" เช่น  AROON01@laya.local
window.__STAFF_EMAIL_DOMAIN__ = "laya.local";

// ตั้ง PIN สำหรับการลบ (Manager delete PIN) → เปลี่ยนได้ตามต้องการ
window.__MANAGER_DELETE_PIN__ = "1234";

// เก็บรูปสูงสุด (วัน) — ใช้ทั้งในปุ่ม Cleanup (manual) และใน Cloud Functions (auto)
window.__RETENTION_DAYS__ = 7;
