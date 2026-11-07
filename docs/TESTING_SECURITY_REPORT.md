# ผลทดสอบและความปลอดภัย — 2026-11-06

ทดสอบเฉพาะเครื่องนี้กับ project **demo-laya-v4** ใน Firebase Emulator. ไม่มีคำสั่ง deploy หรือการแก้ production/billing. ใช้ Node 22.23.4, Java 25, Firebase CLI 15.35.0 และ Playwright 1.64.1. รายงานนี้ไม่ใช่การรับรอง production security.

| Gate | Result | Evidence |
|---|---|---|
| Build and source/config/Hosting boundary check | PASS | `npm run build`, `npm run check`; only public/ hosted, source/backend excluded |
| Domain regression | PASS 5/5 | `npm test`: Bangkok boundary, legacy dates, recurrence/assignment/shift, KPI denominator, points/sanitized profile |
| Security + real callable integration | PASS 9/9 | `npm run test:integration`; final log docs/integration-run.log |
| Chromium workflow | PASS 2/2 | Real browser + Emulator; mobile 393×851 viewport and manager 1440×1000 |
| Installed Windows Microsoft Edge workflow | PASS 2/2 | Playwright Edge channel against same local Emulator |
| Manual screenshot inspection | PASS | Inspected staff-mobile.png and manager-desktop.png; no horizontal page overflow in mobile automated assertion |
| Functions dependency advisory scan | PASS at scan time | npm audit: 0 vulnerabilities after patched sharp and transitive overrides; JSON report included |
| Tooling dependency advisory scan | REMAINING RISK | 3 moderate transitive findings in Firebase CLI → Pub/Sub → OpenTelemetry core; 0 high/critical. Not part of hosted browser bundle or deployed functions dependency tree |
| Real staging, real bucket CORS/IAM/index rollout | NOT TESTED | No cloud deployment/access performed |
| Physical Android camera/install/PWA/background behavior | NOT TESTED | Viewport test is not a physical Android test |
| Service-worker version upgrade during multi-tab upload | NOT TESTED | Update is explicit, blocked while active work/unsaved checklist; needs staged multi-tab acceptance |
| Real App Check enforcement, billing/alerts | NOT TESTED | Configuration/runbook only |
| Drive archive, scheduled backup and restore | NOT TESTED / DISABLED | Destructive cleanup and old archival code removed locally; live scheduler state unknown |

## Security/integrity integration assertions
1. Manager-only checklist JPEG attachment is decoded/reencoded into private canonical Storage, no download token in canonical object metadata; staff access denied; reference preserved by save.
2. Anonymous reads, cross-employee profile reads/listing, forged submission/status, staff role/points change and direct manager business writes denied by Firestore rules. Legacy sharedLeaderboard omitted by server and direct staff profile read blocked when field exists.
3. Storage rejects cross-user upload, incorrect MIME, >2MiB, overwrite, delete and direct final evidence writes. Adding `resource == null` explicitly fixed an overwrite issue observed against the real emulator during development; final regression passes.
4. Callables reject missing Auth, staff manager operations, unassigned task, and fake image content despite JPEG metadata. Client-supplied status/date/points are ignored.
5. Three simultaneous task submissions accept exactly two and reject the third. Canonical ID plus requestId makes retry return the prior result. Other staff cannot read final evidence; owner can.
6. Four concurrent approvals produce one immutable point transaction and one balance increment. Reject requires a reason. Explicit same-day reopen allows a revision without another quota slot; old revision is retained.
7. Two legacy submissions count toward the quota even without a quota document. Historic pointsAwarded prevents re-awarding an old submission.
8. Competing checklist save with stale revision fails, retains current record, and creates history on valid update.
9. Disabled profiles denied, including valid existing Auth sessions; manager accounts cannot be changed through staff administration callable.

## Browser workflows actually executed
Staff login → four assigned task cards → real JPEG compression/selection → note/photo draft survives reload → offline attempt reports failure and creates no server submission → server commits but browser response is deliberately dropped → retry same saved draft produces no duplicate → work history pending → manager private evidence viewer → approve → staff refresh shows +2 points. Manager route denied for staff. Manager creates weekly recurring task, exports CSV, loads all 53 checklist items, switches to Banquet, saves N/A and reloads it. Both browser engines passed. Photos and records used are synthetic.

Initial failures were fixed and rerun: SDK14 namespace imports, immutable upload guard, test fixture isolation/old point ledger, and checklist filter/load race that could overwrite a selection made during load. Final reported PASS values refer to executed passing rounds; failing drafts are not represented as passed tests. Formatting-only cleanup was followed by build/syntax/domain checks. Release build guard is also checked to reject the emulator configuration.

## Practical limits
No claim that every feature in the master request is complete. See LIMITATIONS.md for absent directory/settings administration, historical assignment snapshots, native XLSX/PDF generation, archive integration and cloud operations. Real hardware, cloud rules parity, rate-abuse behavior, HEIC support (not accepted), offline cold-login and large hotel load remain acceptance work. Security rules cannot invalidate legacy public download tokens. Keep deployment gated on staging, approved migration and backup/restore rehearsal.
