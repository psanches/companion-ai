const CACHE_NAME = "lumi-v5";

const STATIC_FILES = [
  "/companion-ai/",
  "/companion-ai/index.html",
  "/companion-ai/style.css",
  "/companion-ai/manifest.json"
];

/*
 * INSTALL
 * Cache only Lumi's basic static shell.
 * app.js is intentionally NOT cached.
 */
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_FILES))
  );

  self.skipWaiting();
});


/*
 * ACTIVATE
 * Remove all old Lumi caches.
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
 * FETCH
 *
 * Important:
 * - Never interfere with API/backend requests.
 * - Never interfere with Supabase.
 * - Never cache app.js.
 * - HTML/navigation is network-first.
 * - Static same-origin files are network-first
 *   with cache fallback.
 */
self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  /*
   * Leave every cross-origin request completely alone.
   * This includes Supabase and the Lumi backend Worker.
   */
  if (url.origin !== self.location.origin) {
    return;
  }

  /*
   * Always get the newest app.js directly
   * from the network.
   */
  if (url.pathname === "/app.js") {
    event.respondWith(fetch(request));
    return;
  }

  /*
   * Navigation / HTML:
   * network first, index.html as offline fallback.
   */
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .catch(async () => {
          const cached =
            await caches.match("/index.html");

          if (cached) {
            return cached;
          }

          return Response.error();
        })
    );

    return;
  }

  /*
   * Other same-origin static resources:
   * network first, cache fallback.
   */
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();

          caches.open(CACHE_NAME)
            .then(cache =>
              cache.put(request, copy)
            );
        }

        return response;
      })
      .catch(async () => {
        const cached =
          await caches.match(request);

        if (cached) {
          return cached;
        }

        return Response.error();
      })
  );
});
