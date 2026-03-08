/**
 * Laya Staff Task — Auto cleanup (7 days) for Firestore + Storage
 *
 * Deploy with Firebase CLI:
 *   firebase deploy --only functions
 *
 * NOTE: Scheduled functions generally require Blaze plan (billing) to run via Cloud Scheduler.
 */

const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");

admin.initializeApp();

const { google } = require("googleapis");
const { Readable } = require("stream");

function ymd(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const da = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${da}`;
}

exports.cleanupOldSubmissions = onSchedule(
  {
    schedule: "every day 03:30",
    timeZone: "Asia/Bangkok",
  },
  async () => {
    const db = admin.firestore();
    const bucket = admin.storage().bucket();

    const retentionDays = Number(process.env.RETENTION_DAYS || 7);

    const now = new Date();
    const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
    const cutoffStr = ymd(cutoff);

    console.log(`Cleanup start. retentionDays=${retentionDays}, cutoffDate=${cutoffStr}`);

    const snap = await db.collection("submissions").where("date", "<", cutoffStr).get();

    if (snap.empty) {
      console.log("No old submissions to delete.");
      return;
    }

    let deletedDocs = 0;
    let deletedFiles = 0;

    let batch = db.batch();
    let batchCount = 0;

    for (const doc of snap.docs) {
      const data = doc.data();
      const photoPath = data.photoPath;

      if (photoPath) {
        try {
          await bucket.file(photoPath).delete({ ignoreNotFound: true });
          deletedFiles++;
        } catch (e) {
          console.warn("Failed to delete file:", photoPath, e?.message || e);
        }
      }

      batch.delete(doc.ref);
      batchCount++;
      deletedDocs++;

      if (batchCount >= 450) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(`Cleanup done. Deleted docs=${deletedDocs}, files=${deletedFiles}`);
  }
);


/**
 * Archive approved submissions to Google Drive (after Manager clicks Approve)
 *
 * How it works:
 * - Trigger on submissions/{subId} update
 * - If status changes to 'approved' AND driveUploaded != true
 *   -> download image from Firebase Storage (photoPath)
 *   -> upload to Google Drive folder (DRIVE_FOLDER_ID)
 *   -> write back driveFileId / driveWebViewLink / driveUploaded
 *
 * Setup (recommended):
 * 1) Enable Google Drive API
 * 2) Create Service Account + key JSON
 * 3) Share target Drive folder to service account email as Editor
 * 4) Create functions/.env (DO NOT commit) with:
 *    DRIVE_FOLDER_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *    DRIVE_SA_KEY_B64=base64_of_service_account_json
 *
 * Notes:
 * - This keeps files in Firebase Storage too (your 7-day cleanup can still run)
 * - If you want to delete from Storage immediately after upload, you can add a delete step.
 */

function getDriveClient() {
  const folderId = process.env.DRIVE_FOLDER_ID;
  const keyB64 = process.env.DRIVE_SA_KEY_B64;

  if (!folderId) throw new Error("Missing DRIVE_FOLDER_ID env var");
  if (!keyB64) throw new Error("Missing DRIVE_SA_KEY_B64 env var");

  const keyJson = JSON.parse(Buffer.from(keyB64, "base64").toString("utf8"));

  const auth = new google.auth.JWT({
    email: keyJson.client_email,
    key: keyJson.private_key,
    scopes: ["https://www.googleapis.com/auth/drive.file"]
  });

  const drive = google.drive({ version: "v3", auth });
  return { drive, folderId };
}

function safeName(s) {
  return String(s || "")
    .replace(/[^\w.\- ]+/g, "_")
    .trim()
    .slice(0, 120);
}

exports.archiveApprovedToDrive = onDocumentUpdated("submissions/{subId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  if (!before || !after) return;

  // Only when status transitions into approved
  if ((before.status || "waiting") === "approved") return;
  if ((after.status || "waiting") !== "approved") return;

  // Idempotency: skip if already uploaded
  if (after.driveUploaded) return;

  if (!after.photoPath) {
    console.log("No photoPath on submission; skip Drive upload.");
    return;
  }

  const { drive, folderId } = getDriveClient();

  const bucket = admin.storage().bucket();
  const file = bucket.file(after.photoPath);

  console.log("Downloading from Storage:", after.photoPath);
  const [buf] = await file.download(); // buffer in memory (your images are ~1-2MB after compression)

  const filename = safeName(`${after.date || "date"}_${after.staffID || "staff"}_${after.taskId || "task"}.jpg`);

  console.log("Uploading to Drive:", filename);
  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId]
    },
    media: {
      mimeType: "image/jpeg",
      body: Readable.from(buf)
    },
    fields: "id, webViewLink"
  });

  const driveFileId = res.data.id;
  const driveWebViewLink = res.data.webViewLink || "";

  console.log("Drive uploaded:", driveFileId);

  // Mark uploaded (write back to Firestore)
  await event.data.after.ref.update({
    driveUploaded: true,
    driveFileId,
    driveWebViewLink,
    driveUploadedAt: admin.firestore.FieldValue.serverTimestamp()
  });
});


/**
 * Cleanup tasks that were NOT done when crossing day.
 * - Runs daily (Asia/Bangkok)
 * - If task.forDate < today AND no submission exists for that task -> DELETE task
 * - If there is a submission -> set active=false (keep record)
 *
 * Note: This only targets tasks that have `forDate` (daily jobs). Side jobs without forDate are not touched.
 */

