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

---

## ✅ Config already filled
ไฟล์ `js/firebase-config.js` ถูกใส่ config ของโปรเจค `laya-staff-task` แล้ว

> ถ้า Storage อัปโหลดไม่ได้ ให้ตรวจใน Firebase Console → Project settings ว่า storageBucket เป็นค่าอะไร (บางโปรเจคจะเป็น `xxxx.appspot.com`)

## ✅ Rules files included
มีไฟล์ rules สำหรับ copy ไปวางที่ Firebase Console:
- `firebase-rules/firestore.rules`
- `firebase-rules/storage.rules`

⚠️ Firestore Rules ที่ตอนนี้เป็น `allow read, write: if false;` จะทำให้เว็บใช้งานไม่ได้ ต้องเปลี่ยนเป็น rules ที่ให้ในไฟล์ด้านบน

---

## ✅ Image compression enabled (target ~2MB)
ระบบจะบีบอัดรูปก่อนอัปโหลดอัตโนมัติ (จำกัดด้านยาวสุด 1600px และพยายามทำให้ไฟล์ ~2MB)

ช่วยให้:
- อัปโหลดเร็วขึ้น
- ประหยัดค่าใช้จ่าย Storage/Download
- ใช้งานกับมือถือได้ลื่นขึ้น

หมายเหตุ iPhone: ถ้าเป็นไฟล์ HEIC/HEIF แล้วมีปัญหา ให้ตั้ง Camera → Formats → **Most Compatible (JPEG)**

---

## ✅ Firebase Config Updated
โปรเจคนี้ถูกตั้งค่าให้ใช้ Firebase โปรเจค: **laya-staff-task-us**
- authDomain: laya-staff-task-us.firebaseapp.com
- storageBucket: laya-staff-task-us.firebasestorage.app

ถ้า login ไม่ผ่านบน GitHub Pages:
Firebase Console → Authentication → Settings → Authorized domains → เพิ่ม `YOURNAME.github.io`


## ✅ Login case-insensitive
Staff ID จะถูกแปลงเป็นตัวพิมพ์เล็กอัตโนมัติ (เช่น MGR01 → mgr01@laya.local) เพื่อลดปัญหา login ไม่ผ่านจากตัวพิมพ์ใหญ่/เล็ก

---

## ✅ Manager Console: Create Task troubleshooting
เวอร์ชันนี้เพิ่ม error message ตอนกด Create Task (ถ้า Firestore Rules ไม่อนุญาต จะขึ้นสาเหตุ เช่น `Missing or insufficient permissions`)

ถ้าขึ้น permissions:
1) ตรวจ Firestore Rules ให้เป็นแบบที่ให้ไว้ (manager role = "manager")
2) ตรวจ `staff/{UID}` ของ manager ต้องใช้ **Document ID = UID** และมี field `role: "manager"`
