// ✅ Firebase config (Project: laya-staff-task)
window.__FIREBASE_CONFIG__ = {
  apiKey: "AIzaSyApG-5lDcGLeyYLSj0HQUWBiWMb61ruhJk",
  authDomain: "laya-staff-task.firebaseapp.com",
  projectId: "laya-staff-task",
  storageBucket: "laya-staff-task.firebasestorage.app",
  messagingSenderId: "247353931810",
  appId: "1:247353931810:web:92a3b4cf95ac2ac831327b",
  measurementId: "G-VQK3CJ8GND"
};

// ระบบนี้จะ login ด้วย Email/Password โดย "แปลง StaffID เป็นอีเมล" เช่น  AROON01@laya.local
window.__STAFF_EMAIL_DOMAIN__ = "laya.local";

// ตั้ง PIN สำหรับการลบ (Manager delete PIN) → เปลี่ยนได้ตามต้องการ
window.__MANAGER_DELETE_PIN__ = "1234";

// เก็บรูปสูงสุด (วัน) — ใช้ทั้งในปุ่ม Cleanup (manual) และใน Cloud Functions (auto)
window.__RETENTION_DAYS__ = 7;
