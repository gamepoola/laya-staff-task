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

---

## ✅ Points system (Manager Approve = +1)
- เมื่อ Manager กด **Approve** ระบบจะเพิ่มคะแนนให้พนักงาน **+1** และสะสมไว้ที่ `staff/{uid}.points`
- ให้คะแนน “ครั้งเดียวต่อ submission” (ใช้ flag `pointsAwarded` กันกด Approve ซ้ำแล้วได้คะแนนเพิ่ม)
- Manager ดูคะแนนทั้งหมดได้ในหน้า **Manager Console → Staff Points**
- Staff ดูคะแนนตัวเองได้ในหน้า **Staff Dashboard**

---

## ✅ Priority-based points
ตอนกด **Approve** คะแนนจะเพิ่มตาม Priority ของ Task:
- Normal = +1
- High = +2
- Critical = +3

ระบบจะบันทึกค่าแต้มที่ให้ไว้ใน submission เป็น `pointsAwardedValue`


---

## ✅ Transaction fix
แก้ error: `Firestore transactions require all reads to be executed before all writes` โดยจัดลำดับใน transaction ให้ **อ่านก่อนเขียน**

---

## ✅ Archive approved photos to Google Drive (optional)
หลัง Manager กด **Approve** ระบบสามารถคัดลอกรูปจาก Firebase Storage ไปเก็บใน Google Drive ได้อัตโนมัติ (ผ่าน Cloud Functions)

ไฟล์ที่เกี่ยวข้อง:
- `functions/index.js` → `archiveApprovedToDrive`
- `functions/.env` (ต้องสร้างเอง และห้าม commit)

สิ่งที่ต้องทำ:
1) เปิด Google Drive API ใน Google Cloud Console
2) สร้าง Service Account + ดาวน์โหลด key (JSON)
3) สร้างโฟลเดอร์ใน Google Drive และ Share ให้ service account email เป็น Editor
4) สร้าง `functions/.env`:
   - `DRIVE_FOLDER_ID=...`
   - `DRIVE_SA_KEY_B64=...`  (base64 ของไฟล์ JSON key)

Deploy:
- `cd functions && npm i`
- `firebase deploy --only functions`

---

## ✅ Fix: Firestore transaction reads-before-writes
ถ้าเคยขึ้น error: `Firestore transactions require all reads to be executed before all writes.`
เวอร์ชัน FINAL แก้แล้ว โดยใน `setStatus()` ทำการอ่าน submission + task (priority) **ก่อน** แล้วค่อยเขียนสถานะ/แต้ม

ถ้ายังขึ้น error หลังอัปไฟล์:
- ให้ทำ Hard refresh (Ctrl+F5) หรือเปิดหน้าเว็บแบบ Incognito เพื่อเคลียร์ cache


---

## ✅ Hide approved from Daily Submissions
หลัง Manager กด **Approve** รายการนั้นจะถูกซ่อนออกจากตาราง Daily Submissions อัตโนมัติ (ค่าเริ่มต้น)
ถ้าต้องการดูรายการที่ Approve แล้ว ให้ติ๊ก `Show approved` ในหน้า Manager Console

---

## ✅ Checklist Report (Manager daily) — The Taste
เพิ่มหน้า `checklist.html` สำหรับ Manager ใช้เช็กงานรายวันตามแบบฟอร์มในไฟล์ PDF “Daily Checklist Restaurant (The Taste)”

วิธีเข้า:
- หน้า Manager Console → ปุ่ม **Checklist report**

การบันทึก:
- Firestore collection: `manager_checklists`
- Document ID: `{Outlet}_{YYYY-MM-DD}_{Shift}` เช่น `The_Taste_2026-03-08_Morning`

⚠️ ต้องอัปเดต Firestore Rules ใน Firebase Console ให้ Manager เขียน collection นี้ได้
ดูตัวอย่างใน `firebase-rules/firestore.rules`

---

## ✅ Checklist update: Shift + Outlet + Action By dropdown
- เพิ่ม Shift: Morning / Afternoon
- เพิ่ม Outlet: The Taste / The Mangrove
- ช่อง Action By เปลี่ยนเป็นแบบเลือกได้ (dropdown):
  1) K.Too
  2) K.Noi
  3) K.Parawee
  4) K.Joy


---

## ✅ Staff Points toggle
หน้า Manager Console เพิ่มปุ่ม `Show points / Hide points` เพื่อซ่อนตารางคะแนน (ลดความรก) และจะโหลดคะแนนเฉพาะตอนเปิดดู

---

## ✅ Daily Job Library + Random assignment (from Daily Job Assighnment.xlsx)
ระบบเพิ่มฐานข้อมูล **Task Library** ที่ collection `task_templates` และมีปุ่ม **Seed library** ในหน้า Manager Console
- จะสร้างงาน preset (Breakfast / Lunch & Dinner) สำหรับ 2 แผนก: The Taste, The Mangrove
- Manager สามารถเลือก Task title จาก Library ได้ (dropdown)
- มีปุ่ม **Random assign jobs** เพื่อสุ่มแจกงานให้พนักงานใน Department ให้ครบทุกงาน (แจกแบบ round-robin)
- งานที่สุ่มจะถูกสร้างใน `tasks` โดยมี `forDate` และ `autoGenerated=true`
- หน้า Staff จะโชว์เฉพาะงานของ “วันนี้” (filter ด้วย `forDate`)

⚠️ อย่าลืมอัปเดต Firestore Rules ใน Firebase Console ให้มี `task_templates`
ดูตัวอย่างใน `firebase-rules/firestore.rules`


---

## ✅ Random assignment: แจกให้ครบคนก่อนแล้วค่อยวนซ้ำ
เวลาสุ่มแจกงาน ระบบจะแจกแบบเป็นรอบ (round-robin): รอบแรกให้ทุกคนได้อย่างน้อย 1 งานก่อน แล้วค่อยเริ่มรอบถัดไป


---

## ✅ Copy yesterday → today
เพิ่มปุ่ม `Copy yesterday → today` ในหน้า Manager เพื่อคัดลอกงานของเมื่อวาน (ตาม Department) มาเป็นงานของวันนี้ โดยคงการ assign ให้พนักงานเดิม
- ค้นหา tasks ที่ `department=...` และ `forDate=เมื่อวาน`
- สร้าง tasks ใหม่ที่ `forDate=วันนี้` พร้อม `copiedFromDate`
- ถ้ามีงาน auto/copy ของวันนี้อยู่แล้ว จะถามก่อนปิดของเดิม


---

## ✅ Auto delete old unsubmitted tasks (cross-day)
เพิ่ม Cloud Function `cleanupUnsubmittedTasksDaily` (Scheduled, Asia/Bangkok) เพื่อจัดการงานรายวันเมื่อข้ามวัน:
- task ที่มี `forDate < วันนี้` และ **ไม่มี submission** → ลบ task ทิ้ง
- ถ้ามี submission → ปิดงาน (`active=false`) เพื่อเก็บประวัติ

Deploy:
- `firebase deploy --only functions`


---

## ✅ Change: ไม่ลบงานข้ามวัน (ดูตามวันที่แทน)
- ยกเลิกการลบงานรายวันเมื่อข้ามวัน
- หน้า Manager: Task List จะแสดงเฉพาะงานของวันที่เลือก (filterDate)
- หน้า Staff: เพิ่ม View date เพื่อดู/ส่งงานย้อนหลังได้ (งานจะแสดงตามวันที่เลือก)
