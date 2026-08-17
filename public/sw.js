// Minimal service worker for the Customer Portal (/portal) and Staff Portal (/staff) — its only
// real job is to exist and control a fetch handler, which is what Chrome/Samsung Internet on
// Android require before they'll offer the "Add to Home Screen" / install-app prompt for a PWA.
// iOS Safari's Add to Home Screen doesn't need this at all, but registering it there is harmless.
// No offline caching is attempted here — both portals are live financial/operational data, so
// serving a stale cached response instead of hitting the network would be actively misleading.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
