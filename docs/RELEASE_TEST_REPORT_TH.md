# ผลทดสอบ release — 7 พฤศจิกายน 2026

Implementation checkpoint `9365336`; frontend build `2d1a7ebb31df`. ทดสอบเฉพาะข้อมูลสังเคราะห์ใน Firebase Emulator ไม่มีการเปลี่ยน production

| ชุดตรวจ | ผลจริง | หลักฐาน |
|---|---|---|
| build/check | PASS | build hash ข้างต้น, syntax/config/53 checklist/Hosting boundary/schedule check |
| domain เดิม | PASS 5/5 | npm test |
| backup codec เพิ่มเติม | PASS 1/1 | npm test; ทดสอบ plain map ไม่ถูกตีความเป็น timestamp/reference |
| ระบบและสิทธิ์ | PASS 10/10 | release-final-tests.log: เดิม 9 + evidenceStatus ownership 1 |
| cleanup | PASS 5/5 | release-final-tests.log |
| staging/restore/pilot provisioning | PASS 4/4 | release-final-tests.log และยืนยันซ้ำ release-recovery-final.log |
| Chromium/Edge | PASS 12/12 | release-final-tests.log: เดิม 10 + expired evidence 2 |
| **รวมกรณีทดสอบที่ไม่ซ้ำ** | **PASS 37/37** | รวมชุดเดิมทั้ง 24 กรณี |

หลังปรับ backup reference type ให้แยกชนิด DocumentReference จริง ได้รัน codec case และซ้อม restore/provisioning 4 กรณีซ้ำผ่านแล้ว ไม่ใช้ผลเก่ามายืนยันโค้ดที่เปลี่ยน

## Cleanup acceptance

| ความต้องการ | หลักฐาน/ผล |
|---|---|
| รูปอายุน้อยกว่า 168 ชั่วโมงไม่ลบ | ผ่าน boundary 168h−1ms และ Storage file ยังมี |
| รูปครบ/เกินอายุถูกลบ | ผ่าน actual timeCreated + clock injection ภายใน module ทดสอบ |
| ไม่ลบ assets/profile/invalid paths | ผ่าน strict classifier และ object ยังมี |
| waiting/rejected ไม่ยืดอายุ | ผ่าน retained submission records ที่อ้างรูปเดียวกันหลังลบ |
| ประวัติและคะแนนคงอยู่ | ผ่าน staff equality, point ledger และ approvals history |
| retry/missing files | ผ่าน repeated run + pending receipt recovery |
| concurrent cleanup | ผ่าน Firestore lease ปฏิเสธงานซ้อน |
| replacement upload | ผ่าน young replacement และ 412 adapter ตรวจ ifGenerationMatch; ยังต้องทดสอบ race บน GCS จริง |
| pagination/resume | ผ่าน pageSize=2, bounded pageSize=1/maxPages=1 แล้ว resume |
| เตือนใกล้หมดอายุ | ผ่าน helper threshold 24h จาก creation time จริง |
| Staff/Manager expired UI | ผ่าน browser ทั้งสองชนิด แสดงข้อความจริง ไม่มี img แตก |
| daily 02:00 Bangkok delivery | NOT TESTED บน Cloud Scheduler จริง; config/code ตรวจแล้ว |

Dry-run สังเคราะห์ล่าสุด scan 3, eligible 3, deleted 0; ดู CLEANUP_DRY_RUN.json รายชื่อใน report จำกัด 1,000 objects โดย counters นับทั้ง scan. clock injection มีเฉพาะฟังก์ชันภายในที่ test เรียก ไม่มี API ให้ browser ปรับอายุ

## Security review

- Firestore/Storage rules และ indexes ไม่เปลี่ยนจาก baseline ตรวจ diff ที่ firebase-rules/ แล้ว ไม่มีการเปิดอ่าน receipt/maintenance ให้ client
- evidenceStatus ตรวจ authenticated active profile/manager และ owner ก่อน metadata; invalid path และ checklist ของ staff ถูกปฏิเสธ
- submit/review transaction, quota, idempotency และ immutable point ledger ไม่เปลี่ยน business logic; tests เดิมผ่านใหม่
- scheduler default dry-run, live delete ต้องตั้ง bucket ที่ตรวจแล้ว และ runtime ปฏิเสธ Soft Delete/versioning/retention/holds/lifecycle ที่ขัดนโยบาย ไม่มี Drive export
- Functions production dependencies: npm audit --omit=dev พบ 0 รายการ ดู release-functions-audit.json
- Tooling: npm audit พบ moderate 3 รายการจาก @opentelemetry/core → @google-cloud/pubsub → firebase-tools ไม่อยู่ใน Functions production dependency tree. ไม่ใช้ npm audit fix --force ที่เสนอเปลี่ยน major/downgrade CLI โดยไม่ตรวจความเข้ากันได้ ต้องประเมิน remediation ก่อน cloud rollout; emulator ผูก loopback. ดู release-tooling-audit.json

## ความผิดพลาดระหว่างพัฒนาและการแก้

กรณี anonymous test สร้างชื่อ Firebase App เป็นตัวเลขเมื่อส่ง null แก้ชื่อ fixture เป็น anonymous แล้วผ่าน. การเขียน screenshot ทับไฟล์ที่ Windows preview ล็อกอยู่แก้เป็น fresh path ต่อรอบ/ต่อ browser; ไม่ตัด test หรือ assertion ธุรกรรมออก. ภาพรอบล่าสุดอยู่ release-captures/2026-11-07/ ทั้ง Chromium และ Edge

## ยังไม่ยืนยัน

Cloud IAM/CORS/App Check, bucket current/noncurrent/soft-deleted versions, live Scheduler/retry, cloud backup/restore, production legacy paths/tokens/archives, Android hardware/camera/PWA install-restart-update และ performance บนเครือข่ายโรงแรมยัง NOT TESTED. Browser offline draft/reload ผ่าน ไม่เท่ากับผ่าน PWA บนอุปกรณ์จริงทุกสถานการณ์

คำแนะนำ release: GO เฉพาะการขออนุมัติและเตรียม staging สังเคราะห์; NO-GO สำหรับ production และ pilot พนักงานจริงจน gates ใน RELEASE_READINESS.md ครบ
