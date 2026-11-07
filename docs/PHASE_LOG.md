# บันทึกการพัฒนาและจุดกู้คืน

## Phase 1 — Audit and Safety
ตรวจ source/configuration ต้นฉบับ 23 ไฟล์และ SVG, เก็บ PNG เดิม 3 ไฟล์, SHA-256 ZIP, สำเนา original แยกจาก app. บันทึกอันตรายเรื่อง PIN, การส่งสถานะปลอม, quota race, การลบหลัง 7 วัน, URL/HTML injection และ leaderboard fan-out ใน AUDIT_REPORT.md. Checkpoint `1bc0282` เก็บต้นฉบับที่ตรวจแล้ว; ไม่มี cloud operation.

## Phase 2 — Security and Data Integrity
ไฟล์หลัก functions/index.js, functions/domain.cjs, firebase-rules/*, firestore.indexes.json. ย้าย mutation ทั้งหมดเข้า authenticated callable; ตรวจ active profile/manager ซ้ำภายใน transaction; quota รวม legacy, idempotent requestId, evidence reencode/server-only path, once-only point ledger, reason/reopen/history, server-side account creation with compensating cleanup. เลิกใช้ PIN และไม่ส่งข้อมูล sharedLeaderboard. Checkpoint `4737e59` และ final commit เก็บการปรับต่อ. Rules/authorization tests และ concurrency ใช้ Emulator จริง; ดูผลรอบสุดท้าย TESTING_SECURITY_REPORT.md.

## Phase 3 — UI/UX
เส้นทาง HTML เดิมยังอยู่; js/app.js รวมหน้าจอที่ใช้ helper/security ร่วมกัน, js/firebase-init.js ใช้ SDK แบบ module, css/style.css ปรับ mobile cards และ dashboard desktop. เลือกไทย/อังกฤษ, ปุ่มสัมผัสใหญ่, สถานะเครือข่าย, ข้อความรอการยืนยัน server. เก็บแม่แบบเดิมใน js/templates.js ครบ 53 checklist items และ task-title library. โครงสร้างข้อมูล/บัญชีเก่าไม่ถูกย้ายอัตโนมัติ.

## Phase 4 — Features
Recurring once/daily/weekly, UID/department/outlet/shift assignment, priority/due time/photo requirement, task/staff editing and deactivation, rejection guidance/reopen revisions, IndexedDB compressed photo drafts, upload progress/retry with same requestId, own cursor history, manager filters/day-range report/local review pagination, CSV formula protection, browser print/PDF. Checklist มีสถานะ Completed/Not Completed/N/A, ผู้รับผิดชอบ, Action By, follow-up และ private photo attachment. เก็บ checklist history พร้อม revision conflict protection. รายงานย้อนหลังใช้ task/profile ปัจจุบันและแสดงข้อจำกัดนี้.

## Phase 5 — Deployment Preparation
เพิ่ม Hosting public/ build boundary, bundled SDK, CSP/headers, explicit PWA update flow, indexes/emulator config, Node22/runtime lockfiles. ค่าเริ่มต้น demo project เท่านั้น; ตัวอย่าง public config เดิมแยกใน config/. คู่มือ staging, migration/rollback, retention/backup/Drive design และค่าใช้จ่ายแนบใน docs. ห้ามสับสน Hosting preview channel กับ isolated staging. ยังไม่ deploy/เปลี่ยน billing/ปิด scheduler บน cloud.

## Phase 6 — Acceptance
Automated Node domain tests, Firestore/Storage security tests, callable races/legacy compatibility/checklist concurrency, Chromium and installed Windows Edge workflows; screenshot visual inspection. Final statuses and untested gates in TESTING_SECURITY_REPORT.md. ไม่มีอุปกรณ์ Android จริง จึงไม่อ้าง PASS สำหรับ physical Android. Production/staging backup, restore, App Check enforcement, Drive archive และ cost measurement ยังไม่ได้ทำ.

Final source commit and separate ZIP are recoverable checkpoints for all phases; packaging manifest lists hashes. Original source remains separately available, while only secure V4 code is packaged for deployment.
