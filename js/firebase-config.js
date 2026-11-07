// Safe default: never connects local development to production.
window.LAYA_CONFIG = {
  environment: "emulator",
  region: "us-central1",
  firebase: {
    apiKey: "demo-key",
    authDomain: "demo-laya-v4.firebaseapp.com",
    projectId: "demo-laya-v4",
    storageBucket: "demo-laya-v4.firebasestorage.app",
    appId: "demo-laya-v4",
  },
  appCheckSiteKey: "",
};
