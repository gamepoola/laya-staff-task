# จัดเตรียม staging และประตูการปล่อยรุ่น

ชุดนี้ยังไม่ deploy และไม่เปิด billing ตัวอย่าง `laya-hotel-pilot-staging` เป็นเพียงชื่อเสนอ ไม่ใช่โปรเจกต์ที่สร้างแล้ว ต้องยืนยันชื่อ project, region, bucket, billing account/งบ, domain, ผู้ดูแล และเวลา deploy ให้ครบก่อนใช้ cloud

1. หลังเจ้าของอนุมัติ target ให้สร้าง/เลือก Firebase project แยก เปิด Email/Password Auth, Firestore Standard, Firebase Storage และ Hosting; คง us-central1 สำหรับรอบนี้ ไม่ย้าย production ตามข้อสมมติ
2. ตั้ง evidence bucket เฉพาะตาม PHOTO_RETENTION_TH.md; backup records ใช้อีก bucket หนึ่งไม่มีรูป ตั้ง least privilege runtime service account ให้เข้าถึงเฉพาะ evidence objects และ Firestore ที่จำเป็น ไม่มี public bucket/download tokens ใหม่
3. เปิด API ที่ต้องใช้หลังอนุมัติ: Cloud Functions, Cloud Run, Cloud Build, Artifact Registry, Firestore, Storage, Cloud Scheduler และ Eventarc ตาม deployment tooling ตรวจ IAM สำหรับ scheduler invoke ให้จำกัด service account ไม่เปิด endpoint cleanup ให้สาธารณะ
4. ลงทะเบียน App Check reCAPTCHA Enterprise สำหรับ staging Hosting domain ยืนยัน token บน browser/PWA ก่อน enforce. ห้ามใส่ debug token ในแพ็กเกจ คู่มือไม่ได้อ้างว่าการ enforce ฝั่ง Auth/Firestore/Storage ถูกเปิดแล้ว ต้องตรวจผลิตภัณฑ์แต่ละตัวจริง
5. เติม public config จริงจากโปรเจกต์ที่อนุมัติในสำเนา config/staging.example.json ไม่แก้ไฟล์ emulator แล้วเรียก `node tools/prepare-staging.cjs reviewed-config.json NEW-artifact-directory` จาก root. ตัวสร้างตรวจชื่อ staging, bucket/Auth domain โปรเจกต์เดียวกัน, region, App Check และ placeholder; สร้าง artifact แยกพร้อม .firebaserc, env, rules/indexes/Functions/Hosting ลบ localhost จาก CSP และเปลี่ยน SW cache version
6. ตรวจ TARGET_REQUIRES_APPROVAL.json และไฟล์ทุกส่วนกับ project ที่อนุมัติ ติดตั้ง dependencies ใน artifact/functions ด้วย npm ci. คง CLEANUP_MODE=dry-run และ RETENTION_BUCKET_REVIEWED=false ก่อนผลตรวจ bucket
7. หลังอนุมัติ deploy เฉพาะ target นั้น ให้ใช้ Firebase CLI พร้อม `--project APPROVED_STAGING_ID` ทุกครั้ง เลือก firestore:rules,firestore:indexes,storage,functions,hosting ตรวจ service URL ว่าไม่มี laya-staff-task-us. คำอธิบายนี้ไม่ใช่การอนุมัติ deploy
8. ตั้ง CORS เฉพาะ staging origin สำหรับ authenticated evidence GET ตรวจ Firebase Storage rules cross-service Firestore permission. ห้ามแก้เป็น public เพื่อแก้ภาพไม่ขึ้น
9. สร้างบัญชีสังเคราะห์ manager/staff ด้วย trusted Admin ไม่ส่งรหัสผ่านลง log ไม่ใช้บัญชีจริงหรือ production export. เครื่องมือ seed-pilot รองรับเฉพาะ emulator; cloud provisioning ต้องทำใน target ที่อนุมัติด้วยกระบวนการผู้ดูแล
10. เรียก 24 baseline cases และ tests ใหม่, ตรวจ private photo/disabled user/App Check/IAM, dry-run แล้วเปิด delete บน staging ที่ทบทวนแล้ว ทดสอบอายุ/รุ่นไฟล์แข่งกันบน GCS จริงและรอบ 02:00 Bangkok. จากนั้นทดสอบ Android จริงและซ้อม restore ด้วย backup สังเคราะห์

ห้ามใช้ Hosting preview channel แทน project แยก เพราะ channel ไม่แยก Auth/Firestore/Functions. ไฟล์ .firebaserc ใน source ยังคง demo-laya-v4 และ client emulator ปฏิเสธ non-localhost. Client staging ตรวจป้องกัน project/bucket/Auth domain ไม่ตรงกันเพิ่มอีกชั้น

Rollback: เก็บ commit, ZIP SHA256, Hosting release และ Functions configuration ก่อน deploy. หยุดรับงานใหม่หากข้อมูลเสี่ยง เก็บ logs/record backup ไม่มีรูป ย้อน Hosting+Functions เป็นชุดที่เข้ากัน; อย่าผ่อน rules. หาก rollback ไปก่อน cleanup ต้องมีแผนรักษานโยบายลบ 7 วันต่อ ไม่ปิด scheduler ทิ้งโดยไม่ติดตาม รูปที่ลบแล้วกู้ไม่ได้ตามนโยบาย

Cloud ที่ยัง NOT TESTED: billing/APIs/IAM, real Storage preconditions, bucket settings/versions, scheduler delivery, App Check enforcement, CORS, cloud backup/restore, live performance. นี่คือชุดพร้อมเตรียม staging ไม่ใช่ใบรับรอง production-ready
