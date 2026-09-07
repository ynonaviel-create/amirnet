/* אופליין: cache-first לקליפה ולנתונים, ורשת-תחילה לכלום — האתר סטטי,
   ועדכון מגיע בהחלפת גרסת המטמון. */
const V = 'amirnet-0fff4343';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './assets/style.css', './assets/tokens.css', './assets/components.css',
  './assets/app.js', './assets/drills.js', './assets/cloud.js', './assets/vendor/supabase.js',
  './data/words.json',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) =>
    Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;   // Supabase תמיד מהרשת
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(V).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => hit))
  );
});
