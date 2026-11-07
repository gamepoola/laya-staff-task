// Shared modern Admin SDK imports for application and local test tooling.
module.exports = {
  ...require("firebase-admin/app"),
  ...require("firebase-admin/firestore"),
  ...require("firebase-admin/auth"),
  ...require("firebase-admin/storage"),
};
