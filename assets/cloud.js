/* ================= Cloud — גשר הענן =================

   כל התקשורת עם Supabase עוברת דרך הקובץ הזה, ורק דרכו. app.js פונה אליו
   אך ורק בצורה window.Cloud?.…, ולכן אם הקובץ הזה נכשל, חסום, או שהקונפיג
   ריק — האתר מתנהג בדיוק כמו קודם: localStorage בלבד, בלי שגיאות.

   העיקרון: localStorage נשאר מקור הקריאה של הממשק. הענן הוא גיבוי וסנכרון —
   כל כתיבה מקומית נרשמת לתור (outbox) ונשלחת ברקע; בהתחברות מושכים את מה
   שבענן וממזגים. הממשק לעולם לא מחכה לרשת. */

(function () {
  'use strict';

  /* ---------- קונפיגורציה ----------
     ריק = הענן כבוי והאתר מקומי לגמרי. ממלאים אחרי יצירת הפרויקט ב-Supabase
     (ראו SETUP-SUPABASE.md). המפתח הוא ה-anon הציבורי — הוא מיועד להיחשף
     בדפדפן; ההגנה האמיתית היא ה-RLS על הטבלה. */
  const CONFIG = {
    url: 'https://ucpgpbeodqfuqfjbolcx.supabase.co',
    anonKey: 'sb_publishable_LXyYIHmPautTU8qKvH5EUA_qVz4nSaK',   // מפתח ציבורי (publishable) — מיועד לדפדפן; ההגנה היא ה-RLS
  };

  /* מיפוי המרחבים בענן אל מפתחות ה-localStorage שבאתר — אותם מפתחות שהעטיפות
     ב-app.js קוראות. המיזוג כותב ישירות למפתחות האלה, והאתר קורא אותם כרגיל. */
  const KEYMAP = {
    cards:   'amirnet.cards',     // word  -> מצב FSRS {st,dd,d,r,l,last,known,at}
    assoc:   'amirnet.assoc',     // word  -> {text,at}
    stats:   'amirnet.stats',     // יום   -> {rev,ok,new,sec}
    attempt: 'amirnet.attempt',   // פריט  -> {chosen,ms,at,pass}
    prefs:   'amirnet.prefs',     // מפתח  -> ערך
    print:   'amirnet.print',     // אצווה -> {words,layout,at,reconciled}
  };
  const OUTBOX_KEY = 'amirnet.outbox';

  /* דיווח 🚩 וסקר לא עוברים ב-outbox בכוונה: הם אירוע חד-פעמי ולא מצב
     שמסתנכרן, והמדווח צריך לדעת מיד אם נקלט. אבל המחיר היה שכשאין רשת
     המידע פשוט מתאדה — ולשני אלה אין הזדמנות שנייה: סטודנט שמילא סקר
     ברכבת לא ימלא אותו שוב. לכן כישלון *רשת* נשמר כאן ונשלח בהזדמנות
     הבאה. כישלון שרת (דחיית RLS, מיגרציה שלא רצה) לא נשמר — הוא לא
     יתוקן מעצמו, וניסיון חוזר רק היה בונה תור נצחי. */

  /* עותק מקומי לא מדבר עם מסד הייצור. זה גם מה שפותח את האתר לבדיקה מקומית:
     REQUIRE_LOGIN נשאר דלוק, אבל השער תלוי ב-Cloud.enabled — ובלי ענן אין
     מסך כניסה, בדיוק כמו שהיה לפני שהענן נולד. `?cloud=1` מדליק בכל זאת,
     למי שכן רוצה לבדוק את זרימת ההתחברות עצמה. */
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const forceCloud = new URLSearchParams(location.search).has('cloud');

  const disabled =
    !CONFIG.url || !CONFIG.anonKey ||
    location.protocol === 'file:' ||
    (isLocal && !forceCloud) ||
    typeof window.supabase === 'undefined';

  /* ממשק ריק כשהענן כבוי — כל הקריאות מ-app.js הופכות ללא-כלום. */
  if (disabled) {
    window.Cloud = {
      enabled: false, user: null,
      init: async () => {}, login: () => {}, logout: async () => {}, setName: async () => {}, syncNow: () => {},
      queue: () => {}, queueDelete: () => {}, queueClear: () => {}, queueClearPrefix: () => {},
      status: () => ({ pending: 0, lastSync: 0, syncing: false }),
    };
    return;
  }

  const sb = window.supabase.createClient(CONFIG.url, CONFIG.anonKey, {
    /* PKCE ולא implicit: implicit מחזיר את הטוקנים ב-#, והאתר מנווט לפי ה-#.
       PKCE חוזר עם ?code= — לא נוגע בראוטר. */
    auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
  });

  const state = {
    session: null,
    lastSync: 0,
    syncing: false,
  };

  const readLS  = (ns) => { try { return JSON.parse(localStorage.getItem(KEYMAP[ns])) || {}; } catch { return {}; } };
  const writeLS = (ns, d) => localStorage.setItem(KEYMAP[ns], JSON.stringify(d));
  const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));

  /* ---------- תור הכתיבות (outbox) ----------
     כל שינוי מקומי נרשם כפעולה בתור, והתור נשלח ברקע עם debounce. התור עצמו
     נשמר ב-localStorage כדי ששינוי של הרגע האחרון ישרוד סגירת טאב — הוא
     יישלח בפתיחה הבאה. פעולה חדשה על אותו מפתח מחליפה את הקודמת (אין טעם
     לשלוח שתי גרסאות של אותה שורה). */
  let outbox = (() => { try { return JSON.parse(localStorage.getItem(OUTBOX_KEY)) || []; } catch { return []; } })();
  const saveOutbox = () => localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));

  let flushTimer = null;
  function push(op) {
    /* בלי session אין למי לשלוח — לא צוברים: המיזוג שבהתחברות ממילא מעלה
       את כל המצב המקומי, אז תור שנצבר לפני התחברות רק היה מסבך. */
    if (!state.session) return;
    if (op.op === 'set' || op.op === 'del') {
      outbox = outbox.filter((o) => !(o.ns === op.ns && o.k === op.k && (o.op === 'set' || o.op === 'del')));
    } else if (op.op === 'clearns') {
      outbox = outbox.filter((o) => o.ns !== op.ns);
    } else if (op.op === 'clearpre') {
      outbox = outbox.filter((o) => !(o.ns === op.ns && (o.op === 'set' || o.op === 'del') && String(o.k).startsWith(op.k)));
    }
    outbox.push(op);
    saveOutbox();
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 1500);
  }

  /* כמה פעמים ברציפות נכשלה האצווה שבראש התור. אפס בכל הצלחה. */
  let headFails = 0;
  const MAX_HEAD_FAILS = 5;

  /* האם השרת דחה את הבקשה לגופה (ולכן ניסיון חוזר לעולם לא יצליח), או שזו
     תקלה חולפת. שגיאת Postgres מגיעה עם code בן חמישה תווים (23514 = הפרת
     check), ושגיאת HTTP עם status בטווח 4xx. נפילת רשת זורקת TypeError בלי
     אף אחד מהם — ואותה דווקא *כן* שווה לנסות שוב, כמה שצריך. */
  const isPermanent = (e) => {
    if (!e) return false;
    const s = Number(e.status);
    if (s >= 400 && s < 500 && s !== 408 && s !== 429) return true;
    return typeof e.code === 'string' && /^[0-9A-Z]{5}$/.test(e.code);
  };

  let flushing = false;
  async function flush() {
    if (flushing || !state.session || !outbox.length) return;
    if (!navigator.onLine) return;                    // אירוע online יקרא לנו שוב
    flushing = true;
    try {
      while (outbox.length) {
        /* רצף כתיבות (set) נשלח כ-upsert אחד; מחיקות — אחת-אחת. הסדר נשמר. */
        /* עד 500 שורות לבקשה: בהתחברות ראשונה עולים אלפי כרטיסים, ובקשה
           אחת בגודל כזה נדחית או נחתכת בטלפון על רשת חלשה. */
        let n = 1;
        if (outbox[0].op === 'set') { while (n < outbox.length && n < 500 && outbox[n].op === 'set') n++; }
        const batch = outbox.slice(0, n);
        await apply(batch);
        outbox.splice(0, n);
        saveOutbox();
        headFails = 0;
      }
      state.lastSync = Date.now();
      emit('cloud:sync');
    } catch (e) {
      /* ── למה יש כאן מונה ולא רק ניסיון חוזר ──
         היה כאן ניסיון חוזר בלבד, וזה עלה ביוקר: פעולה שהשרת דוחה *תמיד*
         (מרחב שם שה-check לא הכיר) נשארה בראש תור ה-FIFO, נכשלה כל עשר
         שניות לנצח, וחסמה מאחוריה את כל ההתקדמות והטעויות של המשתמש —
         בלי שום סימן. גרוע מזה: אצווה אחת מכילה כמה מרחבים, אז שורה אחת
         מורעלת הפילה גם שורות תקינות לגמרי.

         עכשיו: כישלון רשת חולף מקבל את אותם ניסיונות חוזרים כמו קודם, אבל
         פעולה שנכשלת שוב ושוב נזרקת — עדיף לאבד כתיבה בודדת מלהשתיק את
         הסנכרון כולו. הכתיבה שאבדה תשוחזר ממילא במיזוג הבא, כי localStorage
         הוא מקור האמת ו-syncNow מעלה כל מה שקיים רק מקומית. */
      headFails++;
      if (outbox.length && (isPermanent(e) || headFails >= MAX_HEAD_FAILS)) {
        const bad = outbox[0];
        let n = 1;
        if (bad.op === 'set') { while (n < outbox.length && n < 500 && outbox[n].op === 'set') n++; }
        outbox.splice(0, n);
        saveOutbox();
        headFails = 0;
        console.warn('[cloud] פעולה נזרקה מהתור:', bad.ns, bad.op, e && (e.code || e.status || e.message));
      }
      /* התור נשאר שמור — ננסה שוב עוד עשר שניות. */
      clearTimeout(flushTimer);
      flushTimer = setTimeout(flush, 10000);
    } finally {
      flushing = false;
    }
  }

  async function apply(batch) {
    const uid = state.session.user.id;
    const first = batch[0];
    if (first.op === 'set') {
      const rows = batch.map((o) => ({ user_id: uid, ns: o.ns, k: String(o.k), v: o.v }));
      const { error } = await sb.from('am_kv').upsert(rows);
      if (error) throw error;
      return;
    }
    let q = sb.from('am_kv').delete().eq('user_id', uid).eq('ns', first.ns);
    if (first.op === 'del') q = q.eq('k', String(first.k));
    if (first.op === 'clearpre') q = q.like('k', String(first.k).replace(/[%_]/g, '\\$&') + '%');
    const { error } = await q;
    if (error) throw error;
  }

  /* סגירת טאב באמצע ה-debounce: ניסיון-בזק לשלוח את הכתיבות שנותרו עם
     keepalive (שורד ניווט). לא מוחקים מהתור — upsert אידמפוטנטי, ואם
     המשלוח לא הספיק, הפתיחה הבאה תשלח שוב. מחיקות מחכות לפתיחה הבאה. */
  window.addEventListener('pagehide', () => {
    if (!state.session) return;
    const sets = outbox.filter((o) => o.op === 'set');
    if (!sets.length) return;
    const uid = state.session.user.id;
    try {
      fetch(CONFIG.url + '/rest/v1/am_kv?on_conflict=user_id,ns,k', {
        method: 'POST', keepalive: true,
        headers: {
          apikey: CONFIG.anonKey,
          Authorization: 'Bearer ' + state.session.access_token,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(sets.map((o) => ({ user_id: uid, ns: o.ns, k: String(o.k), v: o.v }))),
      });
    } catch { /* best effort */ }
  });
  window.addEventListener('online', () => { flush(); if (state.session) syncNow(); });

  /* חזרה ללשונית או לאפליקציה: מושכים מה שנעשה במכשיר האחר. בלי זה
     מה שלמדת בטלפון הופיע במחשב רק אחרי רענון ידני. לא יותר מפעם בדקה. */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { flush(); return; }
    if (state.session && Date.now() - state.lastSync > 60000) syncNow();
  });

  /* ---------- משיכה ומיזוג ----------
     רץ בהתחברות ובכל פתיחת אתר של משתמש מחובר. מביא את כל השורות (המצב של
     משתמש בודד קטן — מאות בודדות של שורות), ממזג מול המקומי מפתח-מפתח,
     ומה שקיים רק מקומית עולה לענן. כך גם ההגירה של התקדמות ותיקה קורית
     מעצמה בהתחברות הראשונה: הענן ריק, הכל מקומי בלבד — הכל עולה. */
  /* השוואה בלי תלות בסדר המפתחות. jsonb מחזיר מפתחות בסדר של המסד,
     JSON.stringify של אובייקט מקומי מחזיר אותם בסדר ההכנסה, ולכן
     השוואה נאיבית מצאה הבדל בכל שורה ודחפה את כל המרחב בכל סנכרון. */
  function canon(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  }

  function winner(ns, l, r, k, local, remote) {
    const at = (x) => (x && typeof x === 'object' ? Number(x.at) || 0 : 0);

    /* העדפות: החותמת ש-app.js כותב תחת '@'+key מכריעה. בלי זה המקומי
       תמיד ניצח, והעדפה לא עברה בין מכשירים. */
    if (ns === 'prefs') {
      if (String(k).charAt(0) === '@') return Math.max(Number(l) || 0, Number(r) || 0);
      const lt = Number((local || {})['@' + k]) || 0;
      const rt = Number((remote || {})['@' + k]) || 0;
      if (lt !== rt) return lt > rt ? l : r;
      return l === undefined ? r : l;
    }

    /* כרטיס: החזרה המאוחרת יותר היא האמת. מכשיר שנשאר מאחור לא מחייה
       תזמון ישן. app.js כותב at=Date.now() בכל שינוי כרטיס. */
    if (ns === 'cards') {
      if (at(l) !== at(r)) return at(l) > at(r) ? l : r;
      return ((l && l.r) || 0) >= ((r && r.r) || 0) ? l : r;
    }

    /* אסוציאציה, ניסיון, אצוות הדפסה: הכתיבה האחרונה מנצחת. */
    if (ns === 'assoc' || ns === 'attempt' || ns === 'print') {
      return at(l) >= at(r) ? l : r;
    }

    /* סטטיסטיקת יום: מקסימום לכל שדה, במפורש **לא** חיבור. הערך הממוזג
       נכתב בחזרה לענן, וחיבור היה ממזג אותו עם עצמו בסנכרון הבא ומכפיל
       את הספירה. המחיר: שני מכשירים שלמדו במקביל באותו יום — הגדול נבלע
       בקטן. זה מאבד רזולוציה, לא התקדמות. */
    if (ns === 'stats') {
      const out = {};
      const keys = new Set([...Object.keys(l || {}), ...Object.keys(r || {})]);
      keys.forEach((k) => { out[k] = Math.max((l && l[k]) || 0, (r && r[k]) || 0); });
      return out;
    }

    return l;
  }

  async function syncNow() {
    if (state.syncing || !state.session) return;
    state.syncing = true;
    emit('cloud:sync');
    try {
      /* דפדוף חובה: PostgREST קוטם ל-1000 שורות כברירת מחדל, וכל שאלה
         שנענתה היא שתי שורות (seen+seenH) — משתמש פעיל חוצה את זה. בלי
         הלולאה, מכשיר חדש היה מקבל רק את תחילת ההיסטוריה, בשקט. */
      const PAGE = 1000;
      const data = [];
      for (let from = 0; ; from += PAGE) {
        const { data: page, error } = await sb.from('am_kv')
          .select('ns,k,v').order('ns').order('k').range(from, from + PAGE - 1);
        if (error) throw error;
        data.push(...(page || []));
        if (!page || page.length < PAGE) break;
      }

      /* נגזר מ-KEYMAP ולא נכתב ביד. כשהרשימה הייתה כפולה, הוספת מרחב חדש
         (shinunProg) עדכנה מקום אחד ולא את השני — והשורות הגיעו מהשרת
         ונזרקו בשקט. מרחב חדש נכנס עכשיו בשורה אחת, ב-KEYMAP בלבד. */
      const remote = {};
      Object.keys(KEYMAP).forEach((ns) => { remote[ns] = {}; });
      (data || []).forEach((r) => { if (remote[r.ns]) remote[r.ns][r.k] = r.v; });

      const ups = [];
      let changed = false;   // האם המיזוג שינה משהו *מקומית* — רק אז שווה לרנדר מחדש
      Object.keys(KEYMAP).forEach((ns) => {
        const local = readLS(ns);
        const merged = {};
        const keys = new Set([...Object.keys(local), ...Object.keys(remote[ns])]);
        keys.forEach((k) => {
          const l = local[k], r = remote[ns][k];
          let win;
          if (l === undefined) win = r;
          else if (r === undefined) { win = l; ups.push({ op: 'set', ns, k, v: l }); }
          else {
            win = winner(ns, l, r, k, local, remote[ns]);
            /* המקומי ניצח והוא שונה ממה שבענן — מעדכנים את הענן. */
            if (canon(win) !== canon(r)) ups.push({ op: 'set', ns, k, v: win });
          }
          merged[k] = win;
        });
        if (canon(merged) !== canon(local)) { writeLS(ns, merged); changed = true; }
      });

      ups.forEach(push);
      state.lastSync = Date.now();
      emit('cloud:merged', { changed });   // changed=true → app.js מרנדר מחדש את המסך הממוזג
    } catch { /* אין רשת/שרת — נשארים עם המקומי; הפתיחה הבאה תנסה שוב */ }
    finally {
      state.syncing = false;
      emit('cloud:sync');
      flush();   // דיווח/סקר שנתקעו בלי רשת
    }
  }

  /* ---------- session ---------- */
  const NAME_KEY = 'amirnet.name';
  function setSession(session) {
    state.session = session || null;
    if (session) {
      const meta = session.user.user_metadata || {};
      const full = meta.full_name || meta.name || '';
      /* השם שהמשתמש בחר (display_name) גובר; אחרת השם הפרטי מגוגל. localStorage
         הוא מטמון מיידי לפני שהטוקן מתרענן. namedByUser — האם בחר שם במפורש. */
      const chosen = (meta.display_name || '').trim() || (localStorage.getItem(NAME_KEY) || '').trim();
      const first = chosen || String(full).trim().split(/\s+/)[0] || (session.user.email || '').split('@')[0] || '';
      Cloud.user = {
        id: session.user.id,
        email: session.user.email || '',
        name: full || session.user.email || '',
        firstName: first,
        namedByUser: !!(meta.display_name || localStorage.getItem(NAME_KEY)),
      };
    } else {
      Cloud.user = null;
    }
  }

  const Cloud = {
    enabled: true,
    user: null,

    /* נקרא פעם אחת מ-init של app.js, לפני הרינדור הראשון. חסום בזמן קצוב:
       Supabase איטי לא יעכב את הציור — ההתחברות תושלם ברקע ותשודר כאירוע. */
    async init() {
      try {
        const timeout = new Promise((r) => setTimeout(r, 1500));
        const got = sb.auth.getSession().then(({ data }) => setSession(data && data.session));
        await Promise.race([timeout, got]);
      } catch { /* נשארים מנותקים */ }

      /* ניקוי שאריות ה-OAuth מהכתובת (?code=&state=) — supabase-js כבר קרא
         אותן; אם נשאיר, רענון ידני ינסה להחליף code משומש ויציג שגיאה. */
      try {
        if (/[?&](code|state|error_description)=/.test(location.search)) {
          const u = new URL(location.href);
          ['code', 'state', 'error', 'error_description'].forEach((p) => u.searchParams.delete(p));
          history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
        }
      } catch { /* לא קריטי */ }

      if (state.session) syncNow();   // ברקע, בכוונה בלי await
    },

    login() {
      /* חוזרים לכתובת הבסיס בלי ה-#: supabase מוסיף ?code= לכתובת החזרה,
         ושרשור אחרי # היה שובר את הפענוח. ההתקדמות ממילא נשמרת. */
      sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: location.origin + location.pathname },
      });
    },

    async logout() {
      /* לרוקן את התור בעוד ה-session בתוקף — אחרי הניקוי אין ממה לשחזר. */
      try { await flush(); } catch { /* מה שלא נשלח יעלה מהענן של הפעם הקודמת */ }
      try { await sb.auth.signOut(); } catch { /* גם אם השרת לא ענה — מקומית נותקנו */ }
      /* מחשב משותף (ספרייה): בלי הניקוי המשתמש הבא יורש את ההתקדמות הזאת,
         וגרוע מזה — syncNow שלו מעלה אותה לחשבון *שלו*. הענן שומר הכל;
         התחברות מחדש מחזירה את המצב. מנקים רק את המרחבים המסונכרנים —
         העדפות מכשיר (ערכת נושא, סיור) נשארות. */
      outbox = []; saveOutbox();
      Object.values(KEYMAP).forEach((k) => { try { localStorage.removeItem(k); } catch {} });
      try { localStorage.removeItem(NAME_KEY); } catch (e) {}
      emit('cloud:merged', { changed: true });   // מפיל את מטמון seenH שבזיכרון ומרנדר
    },

    /* שם התצוגה שהמשתמש בחר. נשמר גם ב-user_metadata (מסונכרן בין מכשירים)
       וגם ב-localStorage (מיידי, לפני שהטוקן מתרענן). */
    async setName(name) {
      name = String(name || '').trim().slice(0, 40);
      if (!name) return;
      localStorage.setItem(NAME_KEY, name);
      if (Cloud.user) { Cloud.user.firstName = name; Cloud.user.namedByUser = true; }
      emit('cloud:user');
      try { await sb.auth.updateUser({ data: { display_name: name } }); } catch { /* מטמון מקומי כבר עודכן */ }
    },

    /* ---------- בנק השאלות ----------
       חוברות מאל"ו לא יושבות בקוד אלא במסד, ולכן הקריאה כאן ולא ב-fetch
       מקובץ. משתמש שאינו מחובר מקבל טבלה ריקה — זו ההגנה, לא הסתרה. */
    async bank(kind) {
      if (!state.session) return null;
      const out = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await sb.from('am_bank')
          .select('id,v').eq('kind', kind).order('id').range(from, from + PAGE - 1);
        if (error) throw error;
        out.push(...(data || []));
        if (!data || data.length < PAGE) break;
      }
      return out.map((r) => r.v);
    },

    /* זריעה חד-פעמית. ה-RLS מתיר אותה רק לבעלים; לכל אחד אחר זו שגיאה. */
    async seedBank(kind, rows, onProgress) {
      if (!state.session) return { ok: false, reason: 'login' };
      const CH = 200;
      for (let i = 0; i < rows.length; i += CH) {
        const chunk = rows.slice(i, i + CH).map((v, j) => ({ kind, id: String(i + j), v }));
        const { error } = await sb.from('am_bank').upsert(chunk);
        if (error) return { ok: false, reason: error.message };
        if (onProgress) onProgress(Math.min(i + CH, rows.length), rows.length);
      }
      return { ok: true, n: rows.length };
    },

    /* הכניסות מהעטיפות שב-app.js */
    queue: (ns, k, v) => push({ op: 'set', ns, k, v }),
    queueDelete: (ns, k) => push({ op: 'del', ns, k }),
    queueClear: (ns) => push({ op: 'clearns', ns }),
    queueClearPrefix: (ns, prefix) => push({ op: 'clearpre', ns, k: prefix }),

    status: () => ({ pending: outbox.length, lastSync: state.lastSync, syncing: state.syncing }),
    syncNow: () => syncNow(),
  };
  window.Cloud = Cloud;

  sb.auth.onAuthStateChange((event, session) => {
    const had = !!state.session;
    setSession(session);
    emit('cloud:user');
    if (session && !had) syncNow();   // התחברות טרייה (גם השלמת PKCE אחרי redirect)
  });
})();
