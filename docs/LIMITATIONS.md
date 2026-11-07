# ข้อจำกัดและงานถัดไป

แอปนี้ใช้งานและทดสอบในเครื่องกับ Firebase Emulator ได้ แต่ยังไม่ผ่านการอนุมัติใช้งาน production. ข้อจำกัดที่ต้องติดตาม:

1. ต้องทดสอบ staging ด้วย Firebase จริง, bucket CORS/IAM/rules, real Auth/App Check และ Android จริงก่อน rollout. ไม่มีการเข้าถึงหรือแก้ไข project laya-staff-task-us.
2. รุ่น release มี scheduled cleanup 168 ชั่วโมงสำหรับ drafts/evidence/checklistEvidence โดย default dry-run; ยังไม่ deploy หรือเปิดการลบจริง ต้องตรวจ dedicated bucket, legacy submissions/, soft-delete/version backups และ jobs เดิมก่อนเปิดใช้ ดู PHOTO_RETENTION_TH.md. ยกเลิกข้อเสนอ archive รูปทั้งหมด.
3. Quota ยัง 2 งานต่อวัน; ผู้จัดการอาจมอบหมายเกินโควตา จึงต้องตรวจภาระงาน. การเปิดให้ส่งแก้ไขวันเดิมเป็นข้อยกเว้นที่มีประวัติ. Quota แบบ configurable เป็นข้อเสนอ ไม่ได้เปิดใช้.
4. รายงานย้อนหลังอ้างอิงงานและโปรไฟล์ปัจจุบัน; ต้องเพิ่ม assignment snapshots และ approval-event aggregates สำหรับ KPI ย้อนหลังที่คงที่. ไม่มีการอ้างว่าเป็นข้อมูล payroll หรือ compliance audit ที่สมบูรณ์. ข้อมูลเก่าที่อ้าง TaskID/UID ผิดต้องมี mapping ที่ตรวจจริง.
5. การกรองรายงานรองรับ 1–31 วัน เลือกช่วงสัปดาห์/เดือนได้; export เป็น CSV ที่เปิดด้วย Excel และพิมพ์ผ่าน browser เพื่อบันทึก PDF. ไม่มี native .xlsx หรือ PDF generator.
6. Manager window จำกัด 2,000 tasks, 1,000 profiles และ 5,000 submissions; แสดง error เมื่อเกิน ไม่ตัดทิ้งเงียบ ๆ. Review pagination เป็นฝั่ง client ใน window นี้; personal history ใช้ server cursor. โรงแรมขนาดใหญ่ควรใช้ indexed aggregate queries.
7. Departments/outlets/shifts เป็น string fields; ยังไม่มีหน้าจอจัดการ directory/settings หรือแม่แบบ checklist ต่อ outlet แบบแยกเนื้อหา. ค่าเริ่มต้นทุก outlet ใช้ 53 ข้อเดิม; ไม่แต่งเนื้อหามาตรฐานบริการใหม่แทนผู้ใช้. ใช้ The Mangrove ชื่อเดิมเพื่อความเข้ากันได้.
8. Manager role provisioning/reset password ต้องผ่าน trusted administrator. ไม่มี manager-role grant จาก browser. Email บัญชีเดิม @laya.local อาจไม่รับอีเมล reset; โรงแรมต้องกำหนดกระบวนการยืนยันตัวตน/เปลี่ยนรหัสที่ปลอดภัย.
9. แบบร่างพนักงานเก็บใน IndexedDB ภายใน browser profile เครื่องนี้; อุปกรณ์ที่ใช้ร่วมกันควรออกจากระบบ (จะล้างแบบร่าง). Browser storage อาจถูกล้าง/เต็ม จึงไม่ใช่ backup. Checklist มีเตือน unsaved/conflict แต่ยังไม่มี offline checklist editing.
10. Security rules ไม่เพิกถอน public download tokens เดิม. ต้องมีแผน inventory/remediation ที่ได้รับอนุมัติแยกต่างหาก. App Check เป็น optional configuration; ไม่อ้างว่า enforce แล้ว.
11. ซ้อม encrypted records-only backup/restore ใน emulator แล้ว แต่ cloud backup/restore, budget alerts และ monitoring ยังไม่สร้างจริง ต้องอนุมัติ target/billing และทดสอบ staging ก่อน ไม่มี guarantee ค่าใช้จ่ายคงที่.

ลำดับถัดไป: staging + physical Android acceptance → backup/restore and old scheduler disable → approved rollout → historical assignment snapshots/aggregates → ปฏิบัติตามนโยบายลบรูป 7 วันโดยไม่มี archive → configurable quotas and outlet-specific templates.

