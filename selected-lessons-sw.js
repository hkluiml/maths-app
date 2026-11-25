const cacheName = 'p2-maths-offline-v12';
const scope = new URL(self.registration.scope);
const files = [
  'selected-lessons/index.html',
  'selected-lessons/app.webmanifest',
  'selected-lessons/icon-192.png',
  'selected-lessons/icon-512.png',
  'selected-lessons/apps/compare-angles/index.html',
  'selected-lessons/apps/types-of-angles/index.html',
  'selected-lessons/apps/perpendicular-lines/index.html',
  'selected-lessons/apps/directions-combined/index.html',
  'selected-lessons/apps/four-directions/index.html',
  'selected-lessons/apps/multiplication-lesson-1/index.html',
  'selected-lessons/apps/multiplication-groups/index.html',
  'selected-lessons/apps/multiplication-4/index.html',
  'selected-lessons/apps/4x-monster-battle/index.html',
  'selected-lessons/apps/multiplication-mix/index.html',
  'selected-lessons/apps/multiplication-lesson-2/index.html',
  'selected-lessons/apps/6x-mountain/index.html',
  'selected-lessons/apps/multiplication-6/index.html',
  'selected-lessons/apps/multiplication-6-battle/index.html',
  'selected-lessons/apps/multiplication-7/index.html',
  'selected-lessons/apps/multiplication-8/index.html',
  'selected-lessons/apps/multiplication-9/index.html',
  'selected-lessons/apps/classroom-random-number/index.html',
  'direction-treasure/index.html',
  'direction-explorers/index.html',
].map(path => new URL(path, scope).href);
const offlineResources = new Set(files);
let preparing;

function prepareOffline() {
  if (!preparing) {
    preparing = (async () => {
      const cache = await caches.open(cacheName);
      const cached = await Promise.all(files.map(url => cache.match(url)));
      const missing = files.filter((_, index) => !cached[index]);
      if (missing.length) {
        await cache.addAll(missing.map(url => new Request(url, { cache: 'reload' })));
      }
    })().finally(() => { preparing = undefined; });
  }
  return preparing;
}

self.addEventListener('install', event => {
  event.waitUntil(prepareOffline().then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('p2-maths-offline-') && key !== cacheName) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data !== 'prepare-maths-offline' || !event.ports[0]) return;
  const reply = event.ports[0];
  event.waitUntil(prepareOffline().then(
    () => reply.postMessage({ ready: true }),
    () => reply.postMessage({ ready: false })
  ));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== scope.origin) return;
  url.search = '';
  if (url.pathname.endsWith('/')) url.pathname += 'index.html';
  if (!offlineResources.has(url.href)) return;

  const cache = caches.open(cacheName);
  const cached = cache.then(store => store.match(url.href));
  const fresh = fetch(event.request).then(async response => {
    if (response.ok) {
      try { await (await cache).put(url.href, response.clone()); } catch {}
    }
    return response;
  });
  // Use the saved copy immediately and refresh it in the background when online.
  event.respondWith(cached.catch(() => undefined).then(response => response || fresh));
  event.waitUntil(fresh.catch(() => undefined));
});
