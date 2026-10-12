const CACHE_NAME = "lumi-v8";

// Only public app-shell assets are cached. Private chats, auth and medical
// responses must never enter a service-worker cache.
const STATIC_FILES = ["./style.css", "./manifest.json"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith("lumi-") && key !== CACHE_NAME)
            .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Always request the current document and scripts from the network.
  // Do not serve a cached HTML login or medical screen when offline.
  if (request.mode === "navigate" ||
      /\.(?:html|js)$/i.test(url.pathname) ||
      url.pathname.endsWith("/")) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  // Public shell assets may be cached; nothing else.
  if (!STATIC_FILES.some(path => url.pathname.endsWith(path.slice(1)))) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  event.respondWith(
    fetch(request, { cache: "no-store" })
      .then(response => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)));
        }
        return response;
      })
      .catch(async () => (await caches.match(request)) || Response.error())
  );
});
