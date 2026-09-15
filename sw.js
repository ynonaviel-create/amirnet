/* אופליין: cache-first לקליפה ולנתונים, ורשת-תחילה לכלום — האתר סטטי,
   ועדכון מגיע בהחלפת גרסת המטמון. */
const V = 'amirnet-35f09888';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './assets/style.css', './assets/tokens.css',
  './assets/app.js', './assets/lomda.js', './assets/today.js', './assets/progress.js', './assets/exam.js', './assets/words.js', './assets/about.js', './assets/onboard.js', './assets/strategy.js', './assets/drills.js', './assets/cloud.js', './assets/vendor/supabase.js',
  './assets/favicon.svg', './assets/icon-192.png', './data/words.json', './data/quads.json', './data/pairs.json', './data/scale.json',
];
/* cache:'reload' על כל קובץ בקליפה, ולא addAll רגיל. בלעדיו ההתקנה
   מושכת דרך מטמון ה-HTTP של הדפדפן — ו-GitHub Pages מגיש נכסים עם
   max-age — כך שגרסת מטמון חדשה הייתה מתמלאת בקבצים ישנים. זה לא
   תיאורטי: בדיוק ככה תיקון שכבר עלה לשרת לא הגיע לדפדפן. */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(V)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
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
      /* רק תשובות מלאות נכנסות למטמון. תשובת 206 או opaque שנשמרת
         כאן הייתה מוגשת שוב ושוב כקובץ פגום. */
      if (res.ok && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(V).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
