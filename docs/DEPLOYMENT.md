# คู่มือ release ล่าสุด
อ่าน STAGING_RELEASE_TH.md, PHOTO_RETENTION_TH.md และ BACKUP_RESTORE_TH.md ก่อนใช้ขั้นตอนเดิมด้านล่าง ใช้ tools/prepare-staging.cjs สร้าง artifact แยกโดยไม่แก้ config ของ emulator. ยังต้องอนุมัติ exact target/billing ก่อน deploy.

# คู่มือทดสอบและเตรียม deploy

## ในเครื่อง (ไม่ใช้ข้อมูลจริง)
Requires Node 22, npm and Java 21+ for Firebase Emulator. Node 22 executable is included as a development dependency to make `npm` scripts reproducible on the current Node 24 workstation.

```powershell
npm ci
npm ci --prefix functions
npx playwright install chromium
npm run build
npm test
npm run test:integration
```

For interactive local use: `npm start`, then in a second terminal set emulator environment and seed synthetic users:

```powershell
$env:GCLOUD_PROJECT='demo-laya-v4'
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'
npm run seed
```

Seed prints a randomly generated password for test-manager and test-staff. No default password exists in production source. Seed refuses non-demo or missing emulator endpoints. Open http://127.0.0.1:5000. Emulator restart starts fresh unless explicitly exporting fixtures. Never import a production backup into this unprotected local emulator.

## Staging preparation (ยังไม่ได้ deploy)
1. Create/select a separate approved Firebase staging project. Confirm billing and service APIs with owner before enabling anything. Configure Email/Password Auth, Firestore Standard edition, Storage, authorized Hosting domain and region.
2. Replace `js/firebase-config.js` with staging web config, environment `staging`, actual region and appCheckSiteKey. Web API key is public; never place service account files here. See `config/production.example.js` for original public project identifiers. Do not copy production config into local tests.
3. Provision first staging manager with trusted Firebase Admin tooling/console, Auth user and matching staff/{UID}, role manager and active true. Browser cannot grant manager roles. Use existing IDs when migrating accounts.
4. Review Firestore/Storage rules and indexes. Storage rules use Firestore profile reads; confirm cross-service permissions through the Firebase Console. Configure bucket CORS for the exact staging origin and authenticated GET. Private photo viewer requires CORS; do not make the bucket public.
5. App Check client supports reCAPTCHA Enterprise. Register staging domain, observe metrics first. Set functions environment `ENFORCE_APP_CHECK=true` only after valid client tokens confirmed. Enable Firebase product enforcement separately after review. Never ship a debug token. App Check is additional abuse protection, not role authorization.
6. Server defaults to bucket `<projectId>.firebasestorage.app`. If existing bucket differs, configure `EVIDENCE_BUCKET` in functions environment. Default region us-central1 preserves likely US architecture; verify actual Firestore/bucket location before approved changes. Do not move databases based on assumptions.
7. `LAYA_RELEASE=true npm run build` (PowerShell: set `$env:LAYA_RELEASE='true'` first). This refuses the emulator default. Hosting publishes **only public/**, excluding functions, docs, lockfiles and private configuration. Review CSP: remove localhost/ws sources for production, keep only required endpoints; test App Check domains.
8. Only when authorized for that staging target: `npx firebase deploy --project YOUR_APPROVED_STAGING_ID --only firestore:rules,firestore:indexes,storage,functions,hosting`. This guide does not grant production approval. No deploy command has been run during development.
9. Repeat automated tests with synthetic staging accounts plus manual acceptance in Android Chrome/PWA and Windows Edge. Verify upload size/progress/retry, private evidence/CORS, expired token, disabled profile, quota races, rejection/reopen, old records, competing checklist edits, print and export. Check quotas, logs, billing and errors.

## Production gate
Explicit user approval required. Complete `MIGRATION_ROLLBACK.md`, old scheduler disable, backup/restore rehearsal, staging sign-off, dependency review and physical Android test. Set privacy and retention policies. Choose maintenance window because old clients cannot write under V4 rules. Deploy as a coordinated release; ensure users close old tabs and accept the service worker update. Hosting preview channels do not isolate Auth/Firestore/Functions: a separate staging project is required. No private credentials are included in this package.

## Operations
Use Cloud Logging for function failures/latency and append-only auditLogs for decisions. Create reviewed alert policies for elevated permission errors, upload failures, function duration, Storage growth and budget thresholds. Budget alerts do not cap spending. maxInstances=10 limits function concurrency costs but does not impose a total budget. Backup schedules and alert policies are documented proposals; none were created in cloud. The new owner-approved seven-day evidence policy is implemented with dry-run and bucket-review gates; follow PHOTO_RETENTION_TH.md before activation.

