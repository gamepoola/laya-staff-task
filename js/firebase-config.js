// ✅ Firebase config (Project: laya-staff-task-us)
window.__FIREBASE_CONFIG__ = {
  apiKey: "AIzaSyA9vGJU4E8MDeQjj9Ei73KZRhMTG61iAEc",
  authDomain: "laya-staff-task-us.firebaseapp.com",
  projectId: "laya-staff-task-us",
  storageBucket: "laya-staff-task-us.firebasestorage.app",
  messagingSenderId: "720667229826",
  appId: "1:720667229826:web:d8cde53f43ed21d737be9b",
  measurementId: "G-ZHV4RW61DX"
};

// ระบบนี้จะ login ด้วย Email/Password โดย "แปลง StaffID เป็นอีเมล" เช่น  AROON01@laya.local
window.__STAFF_EMAIL_DOMAIN__ = "laya.local";

// ตั้ง PIN สำหรับการลบ (Manager delete PIN) → เปลี่ยนได้ตามต้องการ
window.__MANAGER_DELETE_PIN__ = "1234";

// เก็บรูปสูงสุด (วัน) — ใช้ทั้งในปุ่ม Cleanup (manual) และใน Cloud Functions (auto)
window.__RETENTION_DAYS__ = 7;
