# ความพร้อมรุ่น Hotel Pilot

ฐานตรวจสอบ: HEAD `ede254d` ต่อจาก `fca0946`; build `4037a4a78eba` เป็น hash ของ frontend ไม่ใช่ Git commit ไม่มีการ reset รุ่นย้อนหลัง

Phase 1: build/check ผ่าน, domain 5/5, security/integration 9/9, Chromium+Edge 10/10 รวม 24 กรณีเรียกใหม่ผ่าน ดู docs/release-baseline.log

รุ่นฐานใช้ Functions Node 22/us-central1, Firebase Admin 14.5.0, Functions 7.4.0; Firestore และ Storage rules อยู่ใน firebase-rules/ ไม่ใช่ root. ตรวจ indexes และ schema ใน docs/DATABASE.md แล้ว ค่า quota 2 งานต่อวันคงเดิม UI Tropical Luxury คงเดิม

Blockers ก่อนเริ่ม: ไม่มี target staging ที่เจ้าของอนุมัติ, ไม่มีผลตรวจ IAM/CORS/App Check/Soft Delete/versioning ของ bucket จริง, ไม่มี Android จริง, ไม่มี cloud restore drill หรือ signed pilot acceptance. ไม่ได้เข้าถึงหรือเปลี่ยน production `laya-staff-task-us`

รุ่นฐานไม่มี scheduler; เก็บ drafts/, evidence/, checklistEvidence/ ไม่จำกัดอายุ และมี read-only compatibility ของ submissions/ แบบเก่า นโยบายใหม่แทนคำแนะนำ archive เดิมทั้งหมด ห้ามสำรองรูปลง Drive หรือ archive

Checkpoint rollback: Git baseline ข้างต้นและ ZIP Visual Acceptance เดิมยังอยู่ การ rollback code ไม่สามารถนำรูปที่ถูกลบถาวรกลับมา และห้ามนำรูปกลับมาจาก backup ฝ่าฝืนนโยบาย 7 วัน

## ผลปลายทาง ณ 7 พฤศจิกายน 2026

Implementation commit `9365336` (รุ่นแอป 4.0.0 + pilot release), frontend build `2d1a7ebb31df`. Final packaging commit อยู่ใน RELEASE_MANIFEST.json ที่สร้างตอนแพ็ก. Node runtime 22 และ lockfiles เดิมคงอยู่

build/check ผ่าน; domain+backup codec 6/6, ระบบ/cleanup/release 19/19, browser Chromium/Edge 12/12 รวม 37 กรณีที่ไม่ซ้ำ. ชุดเดิม 24 กรณีผ่านใหม่ครบ. ซ้อม restore/provisioning 4 กรณีซ้ำหลังแก้ codec ผ่าน ดู docs/RELEASE_TEST_REPORT_TH.md และ raw logs

เพิ่ม cleanup 02:00 Bangkok ใช้ Storage creation timestamp + generation precondition, dry-run, lease/cursor/retries และ receipts; เพิ่ม expired evidence/near-expiry warning โดยไม่เปลี่ยน approved UI หรือ business transactions. เพิ่ม staging artifact builder, encrypted records-only backup/restore และ synthetic pilot provisioning 5–10 คน (ทดสอบ 5 คน). ไม่ archive รูป

Functions audit 0 รายการ; dev tooling moderate 3 รายการต้องประเมินก่อน cloud rollout. Rules/indexes ไม่ถูกผ่อน. Runtime delete guard ปฏิเสธ bucket policy ที่เก็บสำเนาขัดกับนโยบาย แต่ค่า bucket จริงยังไม่ถูกตรวจ ไม่มีการรับรองจาก emulator ว่า GCS จริงไม่มี backup/versions

### คำตัดสิน

**GO: local release package และการเตรียม staging ด้วยข้อมูลสังเคราะห์**

**NO-GO: production deployment และ pilot พนักงานจริงในขณะนี้**

ต้องปิด blockers ตามลำดับ:
1. เจ้าของยืนยัน exact staging project/bucket/region, billing และขอบเขต deploy; ชื่อใน config/staging.example.json ยังเป็นตัวอย่าง
2. ตรวจ live IAM/CORS/Auth/App Check/rules/indexes และ dedicated evidence bucket ไม่มี soft-delete/noncurrent/archive copies; สำรวจ legacy submissions/ และ scheduler/Drive backup เดิม ห้ามใช้ broad delete หรือยืดอายุด้วยการ copy migration
3. Dry-run บน staging จริง → ทดสอบ generation race/lease/retry → เปิด scheduler deletion ที่ตรวจแล้ว → ยืนยันรอบ 02:00 และประวัติยังอยู่
4. Cloud records-only backup/restore rehearsal พร้อม Auth UID consistency และการแสดงรูปหมดอายุ
5. Physical Android acceptance ลงนาม และแก้ security tooling finding ตามการประเมิน
6. เจ้าของลงนามแผน pilot 5–10 คน แล้วจึงเริ่มเฝ้าระวังตาม docs/HOTEL_PILOT_TH.md

Rollback มี baseline ZIP/commit และ implementation checkpoint แยกกัน ไม่ลบ checkpoint เดิม. ย้อน code ได้ แต่ไม่กู้รูปหมดอายุและไม่ปิดนโยบาย retention ทิ้งโดยไม่มีแผนทดแทน. ไม่มีการเปิด billing/deploy/cloud alert หรือเปลี่ยน production ระหว่างงานนี้

Deliverables index: docs/STAGING_RELEASE_TH.md, PHOTO_RETENTION_TH.md, CLEANUP_DRY_RUN.json, RELEASE_TEST_REPORT_TH.md, BACKUP_RESTORE_TH.md, RESTORE_REHEARSAL.json, ANDROID_ACCEPTANCE_TH.md, HOTEL_PILOT_TH.md, FIREBASE_COST_TH.md พร้อม source/public/tests/tools ใน ZIP

พบชื่อ legacy jobs ใน source ต้นฉบับ: cleanupOldSubmissions (03:30 Bangkok ลบทั้งรูปและ submission) และ archiveApprovedToDrive (archive รูปหลัง approved). ต้องยืนยันสถานะ live และได้รับอนุมัติการยุติ behavior เดิมก่อน rollout; source ใหม่ไม่มีสองตัวนี้ แต่ไม่ถือว่า cloud เดิมหยุดแล้ว

## Rebranding release — FB Staff APP
ชื่อแอปอย่างเป็นทางการคือ FB Staff APP. Build dc35542858d6, ทดสอบใหม่ 41/41 (unit 8, systems 19, browsers 14). ดู docs/FB_STAFF_APP_TEST_RESULTS_TH.md และ docs/FB_STAFF_APP_FIREBASE_TH.md สำหรับสถานะล่าสุด. Backend/rules/transactions คงเดิม. Production project laya-staff-task-us ยังไม่ปรากฏในรายการที่บัญชี CLI ปัจจุบันเห็น และยังไม่มี cloud deployment. Final packaging metadata ใน RELEASE_MANIFEST.json แทนข้อมูล manifest ของรุ่นก่อน
