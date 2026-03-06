# Laya Staff Task — v3 (Hotel-style)

เพิ่ม 2 อย่างตามที่ขอ:
1) รายงาน “ใครยังไม่ส่งงานวันนี้” (ตามงานที่ถูกมอบหมาย)
2) Auto delete 7 วันแบบอัตโนมัติจริง (Firebase Cloud Functions + Scheduler)

---

## Deploy Web (GitHub Pages)
1) แตกไฟล์ zip แล้วอัปโหลดไฟล์ทั้งหมดขึ้น repo
2) GitHub → Settings → Pages → Deploy from branch → main / root

## ตั้งค่า Firebase (เว็บ)
1) เปิดไฟล์ `js/firebase-config.js` แล้วใส่ config ของโปรเจค
2) Firebase Console → Auth → Authorized domains → เพิ่มโดเมน GitHub Pages ของคุณ เช่น `YOURNAME.github.io`
3) เปิดใช้งาน: Auth (Email/Password), Firestore, Storage

---

## รายงาน “ใครยังไม่ส่งงานวันนี้” ทำงานยังไง
นิยามในระบบ v3:
- “มีงานที่ได้รับมอบหมายอย่างน้อย 1 งาน” และ “ส่งไม่ครบตามงานที่ได้รับมอบหมาย” ในวันที่เลือก (filter date)
- รายงานจะแสดง Submitted X/Y และ Missing

> ถ้าต้องการให้เป็น “ยังไม่ส่งเลยแม้แต่งานเดียว” บอกฉันได้ เดี๋ยวปรับให้

---

## Auto delete 7 วันแบบอัตโนมัติจริง (Cloud Functions)
ในโฟลเดอร์ `functions/` มี Scheduled Function ชื่อ `cleanupOldSubmissions`
- รันทุกวันเวลา 03:30 (Asia/Bangkok)
- ลบ `submissions` ที่ `date < cutoff` และลบรูปใน Storage ที่อยู่ใน `photoPath`

### สิ่งที่ต้องรู้ (สำคัญ)
- Scheduled Functions โดยทั่วไปต้องใช้ Blaze plan (มี billing) เพื่อให้ Cloud Scheduler ทำงานได้

### Deploy Functions (Firebase CLI)
1) ติดตั้ง Firebase CLI (ครั้งแรก):
   - npm i -g firebase-tools
2) Login:
   - firebase login
3) ตั้งค่าโปรเจค:
   - firebase use --add  (เลือกโปรเจคของหน่อย)
4) Deploy:
   - firebase deploy --only functions

### ตั้งค่า retention days (ถ้าต้องการเปลี่ยน)
ค่า default = 7 วัน
- ใน functions จะอ่านจาก process.env.RETENTION_DAYS ถ้ามี
- หรือแก้ในโค้ด functions/index.js

---

## Collections (Firestore)
- staff/{uid}: staffID, name, position, department, role
- tasks/{taskId}: title, description, department, priority, assignedTo, active
- submissions/{subId}: staffUid, staffID, staffName, taskId, date, photoURL, photoPath, status
