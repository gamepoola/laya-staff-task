# FB Staff APP — ไฟล์สำหรับอัปโหลด GitHub

ชุดซอร์สโค้ดล่าสุด: ระบบสมัครพนักงาน รอผู้จัดการเปิดสิทธิ์ และตั้งรหัสผ่านใหม่
ต้นฉบับ commit: bb382adc9483ddeed6ebf56ae0a9d15418331be3
ผลทดสอบรุ่นนี้: 45/45 รายการผ่าน รายละเอียดใน docs/STAFF_ACCOUNTS_TEST_RESULTS_TH.md

## วิธีอัปโหลด
1. แตก ZIP นี้ก่อน ไม่ต้องอัปโหลดตัว ZIP เป็นไฟล์แอป
2. ใน repository เดิม เลือก Add file → Upload files แล้วนำไฟล์และโฟลเดอร์ภายในชุดนี้ไปวางที่รากของ repository (ระดับเดียวกับ README.md และ package.json) ไม่ต้องครอบด้วยโฟลเดอร์ชื่อ ZIP
3. ตรวจให้มี .gitignore, .firebaserc และ functions/.env.example ด้วย เพราะบางเครื่องซ่อนไฟล์ที่ขึ้นต้นด้วยจุด
4. หากมีไฟล์มากเกินข้อจำกัดหน้าเว็บ ให้ใช้ GitHub Desktop คัดลอกชุดนี้เข้าโฟลเดอร์ repository แล้ว Commit และ Push
5. หาก repository เก่ามี .github/workflows ที่ deploy อัตโนมัติ ให้ปิดหรือทบทวนก่อน Push ชุดนี้ไม่มี workflow สำหรับ deploy และการอัปโหลดทับไม่ได้ลบ workflow เก่าที่มีอยู่

## ชุดนี้คือซอร์สโค้ด ยังไม่ใช่เว็บที่เผยแพร่แล้ว
- เก็บค่าทดสอบ Firebase Emulator ไว้เหมือนรุ่นที่ทดสอบผ่าน ไม่ต่อ production อัตโนมัติ
- config/production.example.js เป็นค่า Web SDK อ้างอิงของโครงการเดิม laya-staff-task-us ไม่ใช่ service account และยังไม่ได้เปิดใช้งาน
- ใช้ npm ci ที่ราก และ npm ci --prefix functions จากนั้น npm run build เพื่อสร้างโฟลเดอร์ public
- ไม่มี node_modules, .git, public, log การทดสอบ หรือรหัสลับในชุดนี้ ต้องสร้าง public ก่อนเผยแพร่
- เปิด GitHub Pages จากไฟล์รากโดยตรงยังใช้งานไม่ได้ เพราะต้อง build และ deploy Cloud Functions รุ่นที่ตรงกัน
- การใช้จริงต้องเตรียม Firebase Authentication, Functions และ Hosting พร้อมการตั้งค่าความปลอดภัยก่อน ชุดนี้ไม่ deploy ไม่เปิด billing และไม่ลบข้อมูลเดิม

คู่มือใช้งาน: docs/STAFF_ACCOUNTS_TH.md
คู่มือ Firebase: docs/FB_STAFF_APP_FIREBASE_TH.md
ภาพหน้าจอจริง: docs/accounts-captures/final/Chromium/accounts/
รายงานทดสอบอ้างอิงผลของรุ่นต้นฉบับ; ไฟล์ log ขนาดใหญ่ไม่รวมอยู่ในชุด GitHub นี้
