# Database and business rules / ฐานข้อมูลและกติกา V4

## Compatibility
Retains `staff/{Auth UID}`, `tasks/{id}`, `submissions/{YYYY-MM-DD}__{UID}__{taskId}`, and `manager_checklists/{Outlet_with_underscores}_{date}_{shift}`. Never automatically rewrites existing documents. Server reads legacy `photoPath`, `pointsAwarded`, priority and undated tasks. `sharedLeaderboard` is excluded from callable responses; staff direct profile reads containing this field are denied because Firestore cannot redact fields. Existing managers still recognized by staff.role. No custom claims migration is needed: server checks the current active profile every call and again in mutations' transactions.

## Collections implemented
| Collection | Purpose / fields | Writes |
|---|---|---|
| staff | staffID/name/position/department/outlet/shift/role/active/points | Server; manager can create staff and change operational fields, cannot grant manager role or edit points |
| tasks | title/description/assignedTo/department/outlet/shift/priority/active/forDate/endDate/recurrence/weekdays/dueTime/requiredPhoto | Server manager callable |
| submissions | original identity/date fields plus taskTitle/priority snapshot, note, photoPaths, status, requestId, revision, reviewer | Server atomic submission/review |
| submissions/*/revisions | Previous submission before a manager-authorized resubmission | Server immutable |
| submissions/*/approvals | Decisions, reasons, manager UID, timestamp | Server append-only |
| dailyQuotas | staffUid/date/count | Transactional server counter, reconciled against existing day's rows |
| pointTransactions | Document ID = submission ID; staffUid/value/at | Server transaction once per submission |
| manager_checklists | Existing sections/items, status, done, remark/actionBy/responsible/followUp, note/checkedBy, revision | Manager server callable with compare-and-set revision |
| manager_checklists/*/history | Previous full checklist before update | Server append-only |
| auditLogs | uid/action/target/details/at | Server append-only |
| photoMetadata | checklistId/path/uploaderUid/bytes/at | Server; manager-only read |

Departments/outlets/shifts are currently operational string identifiers, not separate managed directory collections. Future directories, application settings, task-template administration and retention policies are proposed extensions; task title templates and full legacy checklist are bundled locally. Never silently alias `Mangrove` and legacy `The Mangrove`: select actual existing value or plan an explicit approved normalization.

## Business rule decisions
- Maximum **two distinct submissions per employee per Bangkok calendar day**. All statuses count, including rejected. Server date is authoritative. One ID per task/day/person; retries with the same requestId return the existing result. All quota updates and submission writes occur in one transaction. Historic rows are counted even when no quota document exists.
- Initial quota is fixed at two. Proposed next setting: versioned per-task or per-shift quota and a separate attempts policy; do not activate without stakeholder review.
- New explicit exception: manager may reopen a rejected submission on the **same original day**. Staff can submit a revision without another quota slot; old evidence/revision remains. Other-day follow-up requires a new assignment. Approved work cannot be reopened or rejected, and existing awards are not reversed. This is documented instead of silently changing the V3 rule.
- Only waiting → approved/rejected, rejected → reopened, reopened → waiting. Reject requires a reason; own-work approval is denied. Points Normal=1, High=2, Critical=3, snapshotted at submit; legacy uses task priority if no snapshot. Existing pointsAwarded suppresses new points. Ledger ID plus transaction prevents double award.
- Legacy tasks with forDate become one-time on that date. Undated legacy tasks retain daily behavior. Daily/weekly use inclusive start/end dates, weekly Sunday=0..Saturday=6. Matching individual/department/outlet/all plus optional outlet and shift restrictions is enforced on server.
- Deactivate tasks/staff instead of deletion. Evidence retention has a server scheduler at 02:00 Asia/Bangkok, default dry-run; operational records are never removed by it. See PHOTO_RETENTION_TH.md.

## Evidence
Client compresses to JPEG ≤2MiB, max 1600px, up to ten per task. Rules accept create-only `drafts/{uid}/{requestId}/{index}.jpg`; MIME/size/owner validated. Server decodes JPEG with pixel limit, strips metadata/reencodes and copies to `evidence/{uid}/{submissionId}/{requestId}/{index}.jpg`. Clients cannot overwrite/delete either draft or final evidence. Photos viewed with authenticated Storage getBlob, not new public download URLs. Legacy URL tokens may still work until separately revoked. Private downloads require reviewed bucket CORS for the real Hosting origin. Upload failures can leave orphan draft/final files; the release cleanup includes these reserved prefixes after 168 hours, with dry-run and dedicated-bucket gates. See PHOTO_RETENTION_TH.md.

Checklist photo attachments follow the same JPEG validation; managers upload to private `checklistEvidence/{checklistId}/{requestId}.jpg`, with photoMetadata and an audit entry. Checklist saves accept only paths under that checklist ID. Prior evidence references stay in revision history. Attaching a photo does not imply the checklist was saved; the UI explicitly asks the manager to save.

## Reports
Assigned denominator = eligible staff × applicable tasks × selected days. Approved numerator = matching approved submissions; waiting is incomplete; rejected/reopened is missing. No-assignment rate is undefined (display —), never 100%. Overdue = due timestamp passed and not approved. Rejection rate in API = current rejected rows / current submission rows; it does not reconstruct prior rejection attempts. Daily/individual report and filters support 1–31 days (select day, week or month). CSV has UTF-8 BOM and spreadsheet-formula escaping. Browser Print → Save as PDF; native .xlsx and generated PDF files are not implemented.

Historical task/profile edits are not reconstructed: reports explicitly say they use current assignments and profiles. Changes can affect historical denominators; do not use these provisional figures as payroll/disciplinary evidence. Future requirement: dated assignment snapshots plus approval-event trend materialization. Manager data is bounded to 2,000 tasks, 1,000 profiles, 5,000 submissions per window; exceeding a bound returns an error, never a truncated success. Review rows paginate locally 15 per page; personal history uses backend cursors 25 per page. Large hotel-wide analytics needs indexed backend aggregation rather than larger limits.


## Release additions (backward compatible)
`evidenceRetention/{sha256(path)}` contains minimal per-object deletion receipts (generation, creation/deletion time, policyHours, kind, state). `maintenance/evidenceCleanup` holds the server-only lease/cursor and latest summary. No existing document schema or ledger semantics changed. Existing deny-by-default rules cover both collections; authorized status is exposed only through the evidenceStatus callable. No new composite index is required for the single-field pending-receipt query. All photo archives are prohibited by the new owner policy.
