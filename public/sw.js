// Coltasi Fit service worker
//
// Strategy:
// - Same-origin static assets (hashed /_next/static/*, /icons/*, fonts, manifest,
//   favicon) are cached and served cache-first, since they're either immutable
//   (content-hashed) or safe to briefly serve stale while a fresh copy is fetched
//   in the background.
// - Page navigations (HTML) are network-first: always try the network first so
//   you see live data, and only fall back to a cached copy / offline page when
//   there's no connection. This app is full of per-user data (workouts,
//   nutrition targets, scans), so navigations are never served stale-first.
// - Supabase API calls and anything cross-origin are left completely alone —
//   the fetch handler only touches same-origin GET requests, so auth, writes,
//   and live data reads always go straight to the network.
//
// Bump CACHE_VERSION whenever this file's caching behavior changes, so old
// caches get cleaned up on activate.
const CACHE_VERSION = "v1";
const STATIC_CACHE = `coltasi-fit-static-${CACHE_VERSION}`;
const PAGE_CACHE = `coltasi-fit-pages-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [OFFLINE_URL, "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== PAGE_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json" ||
    url.pathname === "/favicon.png" ||
    url.pathname === "/favicon.ico" ||
    url.pathname === "/apple-touch-icon.png" ||
    url.pathname.startsWith("/fonts/")
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Refresh the cache in the background so long-lived entries (icons,
    // manifest) don't stay stale forever, without blocking the response.
    fetch(request)
      .then((response) => {
        if (response.ok) {
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, response));
        }
      })
      .catch(() => {});
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  }
});
