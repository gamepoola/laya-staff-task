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

admin.initializeApp();

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
