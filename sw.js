const CACHE_NAME = "lumi-v6";

const STATIC_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json"
];

// Install the new Service Worker.
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_FILES))
      .then(() => self.skipWaiting())
  );
});

// Remove old Lumi caches and activate immediately.
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key.startsWith("lumi-") && key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Network-first for all same-origin resources.
// Never cache JavaScript, API calls, or authentication.
self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith("/app.js")) {
    event.respondWith(
      fetch(request, { cache: "no-store" })
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .catch(async () =>
          (await caches.match("./index.html")) ||
          (await caches.match("./")) ||
          Response.error()
        )
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME)
              .then(cache => cache.put(request, copy))
          );
        }
        return response;
      })
      .catch(async () =>
        (await caches.match(request)) ||
        Response.error()
      )
  );
});
