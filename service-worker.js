/* My Digital Home — service worker
   Keeps the app working offline. Bump CACHE when you change files
   so the tablet picks up the new version. */
const CACHE = 'mdh-v2';
const SHELL = ['./', 'index.html', 'style.css', 'script.js', 'manifest.json', 'offline.html',
  'assets/icon-192.png', 'assets/icon-512.png', 'assets/icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;          // weather, radio etc. go straight to the network

  const update = fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req.mode === 'navigate' ? 'index.html' : req, copy)); }
    return res;
  });
  if (req.mode === 'navigate') {
    // open instantly from cache, refresh in the background
    e.respondWith(caches.match('index.html').then(hit => hit || update.catch(() => caches.match('offline.html'))));
    e.waitUntil(update.catch(() => {}));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || update.catch(() => hit)));
  e.waitUntil(update.catch(() => {}));
});
