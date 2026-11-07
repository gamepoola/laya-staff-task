# LAYA V4 — Source audit / ตรวจสอบต้นฉบับ

วันที่ 2026-11-06 · ตรวจ source/configuration แบบ text 23 ไฟล์ รวม README, HTML, JS, CSS, rules, configuration และ manifest พร้อม SVG 1 ไฟล์; PNG 3 ไฟล์เป็นสินทรัพย์เดิม ไม่ใช่หลักฐานการทดสอบอุปกรณ์

## 1. Current architecture
Static multi-page HTML + Firebase compat SDK 10.12.5 loaded from CDN. Email/password Auth translates staff ID to lower-case `@laya.local`. Firestore `staff`, `tasks`, `submissions`, `manager_checklists`; Storage under submissions/date/uid/task. Functions Node 18 delete after seven days and archive first approved photo to Drive. Web config points at laya-staff-task-us but CLI alias is a placeholder. No Hosting target, indexes, lockfile or tests.

## 2. Feature inventory / สิ่งที่ต้องเก็บ
Staff login, personal profile/points, individual/department/all assignment, photo compression (1600px/~2MiB), up to ten photos, waiting/approved/rejected, priority points 1/2/3, manager task editing and account creation, missing-work report, checklist Morning/Afternoon for The Taste/The Mangrove, all 53 original checklist items and task title library, printing and PWA icons. Existing approval transaction reads before writes and uses pointsAwarded: preserve its intent and historical balances. Existing email convention and document identities remain.

## 3. Confirmed bugs and suspected risks
- Confirmed: staff/upload.js checks quota using non-atomic reads; concurrent requests exceed two. Client set can claim approved/pointsAwarded and arbitrary dates/tasks.
- Confirmed: staff task query/report ignores forDate; rejected work counted as submitted; report subtracts unrelated submissions.
- Confirmed: cleanupOld references undefined showApproved; auto/manual deletion only deletes photoPath, leaves other photos. Deletes documents even if file deletion fails.
- Confirmed: manager page runs leaderboard fan-out repeatedly; O(N²) personal data duplication and writes. Profile document can exceed 1MiB as staff grows.
- Confirmed: service worker cache-first permanently serves old code, caches broad request scope, immediately activates during upload.
- Confirmed: Drive archive only uploads first photo, race check is outside transaction, retry after Drive create can duplicate, no explicit retry policy. Base64 key is still a private key, not encryption.
- Confirmed: HTML URLs/status/document IDs interpolated into HTML/event handlers; gallery accepts unsafe protocols/markup.
- Confirmed: browser creates Auth account before profile: partial failure leaves orphan account; unresolved StaffID leaves unassigned task.
- Suspected: deployed rules, bucket IAM/download tokens, real quota, scheduled function and Auth settings may differ. No cloud inspection performed.
- Missing: server authorization tests, pagination, structured error recovery, drafts, date/shift recurrence, report exports, App Check, monitoring/restore validation.

## 4. Security findings ranked
CRITICAL: forge status/point flags and task/date on submission create; manager can directly overwrite role/points; default client PIN provides no protection. HIGH: unrestricted photo types/size/overwrite, all profiles visible to any login, arbitrary gallery HTML/URLs, destructive scheduled retention without archive verification. MEDIUM: stale security code cached, no archival idempotency, no audit trail, unbounded queries, orphan accounts/files. Firebase web API key is public configuration, not a credential. No private key found in supplied archive.

## 5. Proposed V4 architecture
Retain Firebase services, identities and collections plus backwards-compatible fields. Keep multi-page routes and original checklist content. All business mutations use authenticated callable Functions with active-profile RBAC, transactional quota/uniqueness/approval and immutable point ledger. Rules deny direct business writes even for managers. Evidence uploads use private immutable per-user draft paths; server verifies decoded JPEG, ownership and assignment before copying to server-only evidence paths. Read photos via authenticated SDK, never publish new download tokens. Backend query pagination; sanitized profile removes sharedLeaderboard. Default local project is demo-laya-v4 with emulators. Node 22, vendored SDK, strict Hosting CSP, explicit update prompt. Destructive cleanup and Drive archive disabled pending operator design/approval.

## 6. Migration and rollback
Untouched extracted original is ../original/laya-staff-task-main, original ZIP SHA256 9068eab413645dc7796b6e036b23da9b4178584bc8e7d2909776d0d5273b52c5. No production operations permitted during this work. Snapshot Auth/Firestore/Storage and deployed function/rules versions before approved rollout. First stage on separate project, copy sanitized fixtures. Preserve IDs, legacy submission photo paths and pointsAwarded flags; quota counts legacy rows on first transaction. Never recompute old points automatically. Disable old scheduler explicitly before rollout; removing its export locally does not disable a deployed schedule. Legacy public download tokens require separately approved remediation. Restore V4 release artifact/rules/functions together; rolling back permissive V3 rules is unsafe. Detailed runbook in docs/MIGRATION_ROLLBACK.md.

## 7. Priorities
P0 authorization, atomic daily cap and idempotency, points ledger, immutable uploads, retention safety. P1 Thai mobile dashboard, rejection guidance, drafts and checklist concurrency. P2 recurrence/outlet/shift, reports and exports. P3 staging acceptance, cost monitoring, archival/backup operations. Physical Android and live cloud workflows must remain NOT TESTED unless actually executed.
