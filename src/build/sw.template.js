/* DevGuru service worker. Generated at build time by src/build/pwaPlugin.ts.
 * Do not edit dist/sw.js by hand: edit src/build/sw.template.js instead.
 *
 * - Every file of the app is saved on the first visit, so all written topics
 *   and both playgrounds' shells work offline afterwards.
 * - Page addresses (navigations) try the network first, then fall back to the
 *   saved app shell, so the newest version is used when online.
 * - Pyodide (Python) files from the CDN are saved the first time Python runs.
 * - A new version waits until the learner taps "Refresh" (see UpdatePrompt).
 */
const VERSION = '__VERSION__';
const PRECACHE = /* __PRECACHE__ */ [];

const APP_CACHE = `devguru-app-${VERSION}`;
const RUNTIME_CACHE = 'devguru-runtime-v1';
const SHELL = '/index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      // cache: 'reload' skips the browser's HTTP cache so files are fresh.
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('devguru-app-') && key !== APP_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isPyodide(url) {
  return url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('/pyodide/');
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    if (response.ok) return response;
    throw new Error(`HTTP ${response.status}`);
  } catch {
    const shell = await caches.match(SHELL);
    return shell || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(networkFirstPage(request));
  } else if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
  } else if (isPyodide(url)) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
  }
  // Anything else goes to the network as normal.
});
