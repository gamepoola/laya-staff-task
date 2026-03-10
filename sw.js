/* Laya Staff Task PWA service worker */
const CACHE_NAME = "laya-staff-task-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./login.html",
  "./staff.html",
  "./manager.html",
  "./upload.html",
  "./checklist.html",
  "./css/style.css",
  "./assets/favicon.svg",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./js/auth.js",
  "./js/checklist.js",
  "./js/firebase-config.js",
  "./js/firebase-init.js",
  "./js/manager.js",
  "./js/staff.js",
  "./js/upload.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Don't cache Firebase/Google API calls
  if (url.hostname.includes("googleapis.com") ||
      url.hostname.includes("firebaseapp.com") ||
      url.hostname.includes("firebasestorage.googleapis.com") ||
      url.hostname.includes("firestore.googleapis.com") ||
      url.hostname.includes("gstatic.com")) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
