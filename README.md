# FB Staff APP

แอปงานพนักงานโรงแรม ภาษาไทย/อังกฤษ สำหรับมือถือและ Windows Edge. รุ่นนี้เตรียมให้ทดสอบในเครื่องและเตรียม deploy ไป staging โดยไม่เชื่อมข้อมูลจริงเป็นค่าเริ่มต้น.

## เริ่มต้น
ติดตั้ง Node 22, npm และ Java 21+ แล้วเปิดโฟลเดอร์นี้:

```powershell
npm ci
npm ci --prefix functions
npx playwright install chromium
npm run build
npm test
npm run check
npm run test:integration
```

ชุด browser acceptance ใช้ Chromium และ Microsoft Edge ที่ติดตั้งใน Windows. หากไม่มี Edge ให้ติดตั้ง Edge หรือเรียก `npx playwright test --project=Chromium` และรายงาน Edge เป็น NOT TESTED. ใช้ `npm start` เปิด Firebase Emulator; seed บัญชีจำลองตาม [คู่มือ](docs/DEPLOYMENT.md) แล้วเข้า http://127.0.0.1:5000. รหัสผ่าน seed สุ่มใหม่ ไม่ใช้ default password. การเปิด HTML จาก file:// ไม่รองรับ Firebase/PWA.

## สิ่งที่ใช้งานได้
พนักงานดูงานวันนี้ ส่งรูป JPEG ที่บีบอัดพร้อมบันทึก ติดตามผล/เหตุผลที่ให้แก้ไข ประวัติและคะแนน; เก็บแบบร่างรูปในเครื่องและลองส่งซ้ำด้วย request ID เดิมเมื่อเครือข่ายขัดข้อง. ผู้จัดการตรวจรูป private อนุมัติ/ปฏิเสธ/เปิดให้แก้ไข มอบหมายงานรายคน/แผนก/outlet/กะ พร้อมงานครั้งเดียว/รายวัน/รายสัปดาห์; จัดการพนักงานและกะ, checklist เดิม 53 ข้อพร้อมรูป/ติดตามผล, รายงานกรองวันที่/แผนก/outlet/พนักงาน ส่ง CSV และพิมพ์/PDF.

การส่งงาน/ตรวจสิทธิ์/quota/คะแนนอยู่บน server; rules ปิดการเขียน business data โดยตรง. การส่งสองงานต่อวันและการให้คะแนนครั้งเดียวต่อ submission ใช้ transaction. ไม่มี PIN สำหรับสิทธิ์ผู้จัดการ. ไม่ลบ historic data อัตโนมัติ.

## เอกสารส่งมอบ
- [Audit](AUDIT_REPORT.md) — สิ่งที่พบและแผน V4
- [Database and business rules](docs/DATABASE.md) — compatibility, collections, KPI
- [Deployment guide](docs/DEPLOYMENT.md) — local/staging/production gates
- [Migration, retention and rollback](docs/MIGRATION_ROLLBACK.md)
- [Testing and security report](docs/TESTING_SECURITY_REPORT.md)
- [Costs](docs/COST_ESTIMATE.md) — assumptions and official sources
- [Phase checkpoints](docs/PHASE_LOG.md)
- [Limitations and priorities](docs/LIMITATIONS.md)

## Source layout
`functions/` trusted backend; `firebase-rules/` rules; `js/` web application/SDK/template source; six HTML routes and `css/`; `tools/build.cjs` bundles into Hosting-only `public/`; `tools/pages.cjs` regenerates HTML from maintained templates (edit templates before regenerating); `tests/` domain/security/integration/browser tests. `config/production.example.js` contains original public Firebase identifiers and is not published. Root configuration defaults to demo-laya-v4. Lockfiles included for both dependency trees; dependency overrides pin patched transitive versions and are exercised by acceptance tests.

ยังไม่ได้ deploy, เปลี่ยน billing, แก้ production หรือทดสอบบน Android จริง. อ่าน limitations ก่อนใช้จริง โดยเฉพาะการปิด scheduler เก่า, URL tokens เดิม, assignment history และ Google Drive archive ที่ปิดไว้.

## การตรวจรับ UI รอบล่าสุด
ดู [รายงานตรวจภาพและขั้นตอนใช้งานภาษาไทย](docs/VISUAL_ACCEPTANCE_TH.md), [ผลทดสอบรอบล่าสุด](docs/VISUAL_TEST_RESULTS_TH.md) และ [แกลเลอรีภาพหน้าจอจริง 8 กลุ่ม](docs/acceptance/index.html). ภาพก่อน/หลังและภาพเต็มหน้ารวมอยู่ในแพ็กเกจนี้.

## Hotel pilot release — 7 พฤศจิกายน 2026
เริ่มจาก [RELEASE_READINESS.md](RELEASE_READINESS.md). นโยบายใหม่ลบหลักฐานหลัง 168 ชั่วโมง ไม่มี archive รูป ดู [คู่มือ staging](docs/STAGING_RELEASE_TH.md), [cleanup](docs/PHOTO_RETENTION_TH.md), [backup/restore](docs/BACKUP_RESTORE_TH.md), [Android จริง](docs/ANDROID_ACCEPTANCE_TH.md), [pilot 5–10 คน](docs/HOTEL_PILOT_TH.md), [ค่าใช้จ่าย](docs/FIREBASE_COST_TH.md). โปรแกรม cleanup default dry-run และยังไม่มี cloud deployment.

## FB Staff APP — ชื่ออย่างเป็นทางการ
คู่มือสภาพแวดล้อมและ production safety ล่าสุดอยู่ที่ docs/FB_STAFF_APP_FIREBASE_TH.md. ชื่อ LAYA ใน Firebase IDs, storage paths, internal cache keys และภาพประวัติการทดสอบเก่าคงไว้เพื่อ compatibility และหลักฐานย้อนหลัง; ชื่อแอปติดตั้งและหน้าจอปัจจุบันคือ FB Staff APP.

## ระบบสมัครและจัดการบัญชีพนักงาน
คู่มือภาษาไทย: [สมัครสมาชิกและจัดการบัญชี](docs/STAFF_ACCOUNTS_TH.md)
ผู้สมัครตั้งรหัสผ่านเองและรอผู้จัดการเปิดสิทธิ์ ผู้จัดการสร้างบัญชี เปิด–ปิดสิทธิ์ แก้ไขข้อมูล และตั้งรหัสผ่านพนักงานใหม่ได้ การสร้างบัญชีผู้จัดการยังต้องดำเนินการโดยผู้ดูแลระบบ
