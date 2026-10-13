// Coltasi service worker
//
// Goal: the installed app always opens, even with no connection, showing the
// last-synced version of each screen.
//
// Strategy:
// - Same-origin static assets (hashed /_next/static/*, /icons/*, /brand/*,
//   fonts, manifest, favicons) are cache-first with a background refresh.
// - Page navigations (HTML) are network-first. Every successful page load is
//   saved under a normalized address (query string stripped, so the PWA's
//   launch URL "/?source=pwa" and "/" share one entry). With no connection,
//   or if the network hangs past NAV_TIMEOUT_MS while a cached copy exists,
//   the cached copy is served instead.
// - The app asks the worker to "warm" the main tabs after sign-in (message
//   {type: "warm"}), so Overview / Train / Progress / Coach are available
//   offline even if they weren't opened recently. Warming also caches the JS
//   and CSS each page needs, so cached pages are fully interactive.
// - Supabase, server actions (POST) and anything cross-origin are left alone:
//   writes always go to the network and fail visibly when offline.
// - In-app tab switches fetch RSC data rather than full pages. Those aren't
//   cached; when one fails offline, Next.js falls back to a full page load,
//   which this worker then serves from the page cache.
//
// Bump CACHE_VERSION whenever this file's caching behavior changes, so old
// caches get cleaned up on activate.
const CACHE_VERSION = "v6";
const STATIC_CACHE = `coltasi-static-${CACHE_VERSION}`;
const PAGE_CACHE = `coltasi-pages-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";
const NAV_TIMEOUT_MS = 6000;
const WARM_PATHS = ["/", "/train", "/train/choose", "/train/history", "/progress", "/progress/lifting", "/coach", "/sleep", "/settings"];
const WARM_MIN_INTERVAL_MS = 10 * 60 * 1000;

const PRECACHE_URLS = [OFFLINE_URL, "/manifest.json", "/brand/coltasi-bird.svg"];

let lastWarm = 0;

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
    url.pathname.startsWith("/brand/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname === "/manifest.json" ||
    url.pathname === "/favicon.svg" ||
    url.pathname === "/favicon-32.png" ||
    url.pathname === "/favicon.ico" ||
    url.pathname === "/apple-touch-icon.png"
  );
}

// One cache entry per screen, whatever query string it was opened with.
function pageKey(url) {
  const u = new URL(url);
  let path = u.pathname;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return `${u.origin}${path}`;
}

// Only cache real app pages: a direct 200, not a redirect (e.g. bounced to the
// login screen). Redirected responses also can't be replayed for navigations.
function isCacheablePage(response) {
  if (!response || !response.ok || response.redirected || response.type === "opaqueredirect") return false;
  const type = response.headers.get("content-type") || "";
  return type.includes("text/html");
}

async function cachePage(url, response) {
  const path = new URL(url).pathname;
  if (path.startsWith("/login") || path.startsWith("/signup") || path.startsWith("/auth")) return;
  const cache = await caches.open(PAGE_CACHE);
  await cache.put(pageKey(url), response);
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreVary: true });
  if (cached) {
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

async function cachedPage(url) {
  const cache = await caches.open(PAGE_CACHE);
  return cache.match(pageKey(url), { ignoreSearch: true, ignoreVary: true });
}

async function networkFirstNavigation(event) {
  const { request } = event;
  const cached = await cachedPage(request.url);

  const network = fetch(request).then((response) => {
    if (isCacheablePage(response)) {
      event.waitUntil(cachePage(request.url, response.clone()));
    }
    return response;
  });

  try {
    if (!cached) return await network;
    // A cached copy exists: don't let a hanging connection (weak signal)
    // keep the app on a blank screen.
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NAV_TIMEOUT_MS));
    const winner = await Promise.race([network, timeout]);
    if (winner) return winner;
    network.catch(() => {});
    return cached;
  } catch (err) {
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    throw err;
  }
}

// Fetch the main screens plus the JS/CSS they reference, so they open offline.
async function warm() {
  const now = Date.now();
  if (now - lastWarm < WARM_MIN_INTERVAL_MS) return;
  lastWarm = now;

  const assets = new Set();
  await Promise.all(
    WARM_PATHS.map(async (path) => {
      try {
        const url = new URL(path, self.location.origin).href;
        const response = await fetch(url, { credentials: "same-origin", redirect: "follow" });
        if (!isCacheablePage(response)) return;
        const html = await response.clone().text();
        for (const m of html.matchAll(/["'(](\/_next\/static\/[^"')\s\\]+)/g)) assets.add(m[1]);
        await cachePage(url, response);
      } catch {
        // Offline or failed: try again next time.
      }
    })
  );

  const cache = await caches.open(STATIC_CACHE);
  await Promise.all(
    [...assets].map(async (path) => {
      try {
        if (await cache.match(path)) return;
        const response = await fetch(path);
        if (response.ok) await cache.put(path, response);
      } catch {}
    })
  );
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "warm") {
    event.waitUntil(warm());
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(event));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  }
});
