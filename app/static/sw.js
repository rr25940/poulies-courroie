const CACHE_NAME = "poulies-courroies-shell-v3";
// Free hosting sleeps when idle: after this delay a page is served from the cache, and the
// loading screen covers the server's wake-up while the network copy refreshes the cache.
const PAGE_TIMEOUT_MS = 3000;
const SHELL = [
  "/",
  "/privacy",
  "/static/css/app.css",
  "/static/js/app.js",
  "/static/js/charts.js",
  "/static/js/drive.js",
  "/static/js/steps.js",
  "/static/favicon.svg",
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png",
  "/static/manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  const network = fetch(event.request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    }
    return response;
  });
  const fromCache = () => caches.match(event.request).then((cached) => cached || caches.match("/"));
  const first = event.request.mode === "navigate"
    ? Promise.race([network, new Promise((resolve) => setTimeout(resolve, PAGE_TIMEOUT_MS))])
    : network;

  event.respondWith(
    first
      .then((response) => response || caches.match(event.request).then((cached) => cached || network))
      .catch(fromCache)
  );
  event.waitUntil(network.catch(() => {}));
});
