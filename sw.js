/* App-shell cache: opens instantly and works offline. Data is cached separately in IndexedDB. Bump VERSION on each release. */
const VERSION = 'ksd-v15', SHELL = ['./', 'index.html', 'css/app.css', 'manifest.webmanifest', 'js/config.js', 'js/util.js', 'js/store.js', 'js/filters.js', 'js/charts.js', 'js/ui.js', 'js/app.js',
  'js/pages/overview.js', 'js/pages/orders.js', 'js/pages/products.js', 'js/pages/customers.js', 'js/pages/geography.js', 'js/pages/channels.js', 'js/pages/stores.js', 'assets/icon-192.png', 'assets/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;           // Apps Script API etc. go straight to the network
  e.respondWith(caches.open(VERSION).then(async c => {                                // stale-while-revalidate
    const hit = await c.match(e.request), net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
