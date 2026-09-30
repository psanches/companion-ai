const CACHE_NAME = "companion-ai-v3";

const BASE = "/companion-ai/";

const STATIC_FILES = [
  BASE,
  BASE + "index.html",
  BASE + "style.css",
  BASE + "manifest.json"
];

/*
 * Install
 * Cache only the static application shell.
 * app.js is deliberately NOT precached.
 */
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_FILES))
  );

  self.skipWaiting();
});

/*
 * Activate
 * Delete every older Lumi cache.
 */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/*
 * Fetch
 *
 * JavaScript and HTML:
 * ALWAYS try the network.
 * Do not store app.js in the Service Worker cache.
 *
 * Other static files:
 * Network first, cache as fallback.
 */
self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Never cache Lumi's JavaScript.
  if (
    url.origin === self.location.origin &&
    url.pathname.endsWith("/app.js")
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // Always prefer fresh HTML/navigation.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match(BASE + "index.html"))
    );
    return;
  }

  // Other static resources: network first.
  event.respondWith(
    fetch(request)
      .then(response => {
        if (
          response.ok &&
          url.origin === self.location.origin
        ) {
          const copy = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => cache.put(request, copy));
        }

        return response;
      })
      .catch(() => caches.match(request))
  );
});
