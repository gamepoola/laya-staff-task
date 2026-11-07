const CACHE = "laya-v4-BUILD_HASH";
const ASSETS = [
  "./login.html",
  "./staff.html",
  "./manager.html",
  "./upload.html",
  "./checklist.html",
  "./css/style.css",
  "./css/premium.css",
  "./assets/resort.svg",
  "./assets/fonts/noto-sans-thai-thai-400-normal.woff2",
  "./assets/fonts/noto-sans-thai-thai-600-normal.woff2",
  "./js/bundle.js",
  "./js/firebase-config.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./assets/favicon.svg",
];
self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS))),
);
self.addEventListener("message", (event) => {
  if (event.data === "ACTIVATE_UPDATE") self.skipWaiting();
});
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("laya-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      ),
  ),
);
self.addEventListener("fetch", (event) => {
  const u = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    u.origin !== location.origin ||
    !ASSETS.some((p) => new URL(p, location).pathname === u.pathname) ||
    u.search
  )
    return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then((r) => r || Response.error()),
    ),
  );
});
// Branding assets are included in build identity; original draft/cache identifiers preserve upgrades.
