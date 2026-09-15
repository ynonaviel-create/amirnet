/* ================= אמירנט — המנוע =================

   מבנה: נתונים (data/*.json) נפרדים מהמנוע, כמו בארכיון השחזורים. המצב
   נשמר ב-localStorage ומסונכרן דרך window.Cloud — שאם הוא כבוי, האתר
   עובד בדיוק אותו דבר, מקומית.

   כל החלטת מוצר כאן נגזרת ממבנה הבחינה: 19 שאלות נספרות, מהן 12 השלמת
   משפטים. לכן אוצר המילים הוא הליבה, והדרילים ממופים למקורות הנקודות
   לפי משקלם. הפירוט ב-README.
   =================================================== */
'use strict';

(function () {

/* ---------- קבועים ---------- */
const EXAM_DEFAULT = '2026-10-22';
const OWNER = 'ynonaviel@gmail.com';
const DAY = 86400000;

/* ימים שבהם לא לומדים, עד המבחן. חול המועד (27.9-2.10) הוא זמן לימוד
   ולכן לא מופיע כאן. השבתות נגזרות מיום השבוע ולא נכתבות ביד. */
const HOLIDAYS = {
  '2026-09-12': 'ראש השנה',
  '2026-09-13': 'ראש השנה',
  '2026-09-21': 'יום כיפור',
  '2026-09-26': 'סוכות',
  '2026-10-03': 'שמחת תורה',
};
const EREV = { '2026-09-11': 1, '2026-09-20': 1, '2026-09-25': 1, '2026-10-02': 1 };

/* ---------- כלי עזר ---------- */
const $  = (s, r) => (r || document).querySelector(s);
const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const today = () => iso(new Date());
const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
const between = (a, b) => Math.round((parseISO(b) - parseISO(a)) / DAY);
const heDate = (s) => { const d = parseISO(s); return d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear(); };
const isShabbat = (s) => parseISO(s).getDay() === 6;
const isOff = (s) => isShabbat(s) || !!HOLIDAYS[s];
const isHalf = (s) => !isOff(s) && (parseISO(s).getDay() === 5 || !!EREV[s]);

/* כמה ימי לימוד נשארו בפועל. ערב חג ויום שישי נספרים כחצי — התוכנית
   מתייחסת אליהם כחצי מנה, אז גם החישוב צריך. */
function studyDaysLeft(from, to) {
  let n = 0;
  for (let d = from; d < to; d = addDays(d, 1)) {
    if (isOff(d)) continue;
    n += isHalf(d) ? 0.5 : 1;
  }
  return n;
}

/* ================= תזמון =================
   המנוע — רמות, סינון, שינון ותרגול — יושב ב-lomda.js. כאן רק עטיפות
   שדרכן שאר הקבצים (בליץ, מסך המילים) מדברים איתו. */
const L = () => window.AMLomda;
const bucket = (c) => (L() ? L().bucket(c) : (c ? 'young' : 'new'));

/* ================= אחסון =================
   מטמון בזיכרון + כתיבה מושהית ל-localStorage. בלי המטמון כל שיפוט על
   כרטיס היה מפרסר ומסדר מחדש מאות קילובייטים, וזה מורגש בטלפון. */
const KEY = {
  cards: 'amirnet.cards', assoc: 'amirnet.assoc', stats: 'amirnet.stats',
  attempt: 'amirnet.attempt', prefs: 'amirnet.prefs', print: 'amirnet.print',
};
const cache = {}, dirty = new Set();
let saveTimer = null;

function ns(n) {
  if (!cache[n]) {
    try { cache[n] = JSON.parse(localStorage.getItem(KEY[n])) || {}; } catch (e) { cache[n] = {}; }
  }
  return cache[n];
}
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    dirty.forEach((n) => {
      if (!cache[n]) return;            // המטמון הופל בין הכתיבה לטיימר
      try { localStorage.setItem(KEY[n], JSON.stringify(cache[n])); } catch (e) {}
    });
    dirty.clear();
  }, 400);
}
function put(n, k, v) {
  ns(n)[k] = v; dirty.add(n); saveSoon();
  /* הכתיבה המקומית כבר קרתה. תקלה בתור הענן לא אמורה להפיל את הקורא —
     סגירת פרק כותבת כרטיס אחר כרטיס, ושגיאה באמצע הייתה משאירה חצי
     מהפרק לא רשום ומסך תקוע. */
  try {
    if (window.Cloud && window.Cloud.enabled && window.Cloud.queue) window.Cloud.queue(n, k, v);
  } catch (e) { /* יסונכרן בהזדמנות הבאה */ }
}
const pref = (k, d) => (k in ns('prefs') ? ns('prefs')[k] : d);
/* חותמת זמן לצד כל העדפה. בלעדיה מיזוג הענן לא ידע איזו משתי גרסאות
   חדשה יותר, והכלל היה "המקומי תמיד מנצח" — כלומר העדפה שנקבעה בטלפון
   לא הגיעה למחשב לעולם. המפתח מתחיל ב-@ ולכן לא מתנגש בשום העדפה. */
const setPref = (k, v) => { put('prefs', '@' + k, Date.now()); put('prefs', k, v); };

/* מיזוג מהענן מפיל את המטמון כדי לקרוא מחדש מ-localStorage. חובה לשטוף
   קודם: בלי זה כתיבה שנעשתה ב-400 המילישניות האחרונות נשארת בתור ה-dirty,
   הטיימר יורה על מטמון שכבר נמחק, JSON.stringify(undefined) מחזיר undefined,
   ו-localStorage שומר את המחרוזת "undefined" — כלומר כל מרחב הכרטיסים נמחק. */
function flushNow() {
  clearTimeout(saveTimer);
  dirty.forEach((n) => {
    if (!cache[n]) return;
    try { localStorage.setItem(KEY[n], JSON.stringify(cache[n])); } catch (e) {}
  });
  dirty.clear();
}

document.addEventListener('cloud:merged', (e) => {
  flushNow();
  Object.keys(cache).forEach((k) => delete cache[k]);
  S.exam = pref('exam', EXAM_DEFAULT);
  /* רינדור רק כשהמיזוג שינה משהו. הסנכרון רץ עכשיו גם בכל חזרה ללשונית,
     ורינדור סתמי היה מוחק חיפוש שהקלדת באמצע. */
  if (!e.detail || e.detail.changed) { applyTypo(); render(); }
});

/* ================= מצב ================= */
const S = {
  words: new Map(),     // word -> {w,n,pos,he,def,syn} — מילון, פומבי
  sent:  new Map(),     // word -> המשפט מהמבחן. תוכן של מאל"ו: מגיע מהמסד
  bank:  {},            // מטמון בנק השאלות לסשן הנוכחי
  exam: EXAM_DEFAULT,
  view: 'home',
  ready: false,
};

const card  = (w) => ns('cards')[w];
const assoc = (w) => (ns('assoc')[w] || {}).text || '';
const sentOf = (w) => S.sent.get(w) || '';

/* ---------- סטטיסטיקת היום ---------- */
function day() {
  const t = today(), all = ns('stats');
  if (!all[t]) all[t] = { rev: 0, ok: 0, new: 0, sec: 0 };
  return all[t];
}
function bump(patch) {
  const t = today(), d = day();
  Object.keys(patch).forEach((k) => { d[k] = (d[k] || 0) + patch[k]; });
  d.at = Date.now();
  put('stats', t, d);
}
function streak() {
  const all = ns('stats');
  let n = 0, d = today();
  if (!all[d] || !all[d].rev) d = addDays(d, -1);
  while (all[d] && all[d].rev) { n++; d = addDays(d, -1); }
  return n;
}

/* ---------- תורים ---------- */
const dueList = () => (L() ? L().dueWords() : []);
const newList = () => (L() ? L().newList() : []);
const markKnown = (w) => L() && L().markKnown(w);
/* שיפוט מהבליץ ומהפיוס: נכון / לא נכון, דרך אותו מנוע */
const gradeWord = (w, ok) => L() && L().answer(w, ok);

/* ================= תצוגה ================= */
/* מצב ריק/שגיאה אחיד. עד עכשיו מסך בלי נתונים היה פשוט ריק, וזה
   נקרא כתקלה גם כשהכול תקין. */
function state(head, body, action) {
  const d = el('div', 'state', '<span class="sh">' + esc(head) + '</span>' + body);
  if (action) {
    const b = el('button', 'btn', esc(action.label));
    b.onclick = action.fn;
    d.appendChild(b);
  }
  return d;
}
function skeleton(n) {
  const d = el('div');
  for (let i = 0; i < (n || 3); i++) d.appendChild(el('div', 'skel'));
  return d;
}
/* רטט קצר בשיפוט. נכשל בשקט בדפדפנים שלא תומכים, וזה בסדר. */
function buzz(ms) {
  try { if (navigator.vibrate && !matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate(ms || 12); } catch (e) {}
}

/* עברית סופרת אחרת באחד. "שינית 1 תשובות" ו-"רצף של 1 ימים" הם
   בדיוק סוג הפרט שגורם לאפליקציה להרגיש לא גמורה. */
const plural = (n, one, many) => (n === 1 ? one : n + ' ' + many);

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 2400);
}

/* ימים למבחן — מספר אחד בפינה, במקום סרגל ימים שלם */
function spine() {
  const d = $('#days');
  if (!d) return;
  if (!S.ready) { d.hidden = true; return; }
  const left = Math.max(0, between(today(), S.exam));
  d.hidden = false;
  d.innerHTML = '<b>' + left + '</b> ימים למבחן';
  d.title = heDate(S.exam);
}

/* אייקונים בקו אחד, בלי ספריות */
const ICON = {
  home:  '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  lomda: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h7M9 12h5"/>',
  drill: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>',
  play:  '<rect x="3" y="7" width="18" height="12" rx="4"/><path d="M8 11v4M6 13h4"/><circle cx="16" cy="12" r="1"/><circle cx="18" cy="14.5" r="1"/>',
  more:  '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
};
const svg = (k) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[k] + '</svg>';

const NAV = [
  ['home',  'בית'],
  ['lomda', 'לומדה'],
  ['drill', 'תרגול'],
  ['play',  'משחקים'],
  ['more',  'עוד'],
];
/* מסכי-בן ולשונית האם שלהם */
const PARENT = { words: 'lomda', fix: 'drill', focus: 'drill', prog: 'more', strat: 'more', pat: 'more', about: 'more' };
function nav() {
  const n = $('#nav');
  if (!S.ready) { n.hidden = true; return; }
  n.hidden = false; n.innerHTML = '';
  const at = PARENT[S.view] || S.view;
  NAV.forEach(([k, t]) => {
    const b = el('button', at === k ? 'on' : '', '<span class="ic">' + svg(k) + '</span>' + t);
    if (at === k) b.setAttribute('aria-current', 'page');
    b.onclick = () => go(k);
    n.appendChild(b);
  });
}
function go(v) { S.view = v; render(); window.scrollTo(0, 0); }

const VIEWS = {
  home:  () => window.AMToday && window.AMToday.home,
  fix:   () => window.AMToday && window.AMToday.fix,
  lomda: () => window.AMLomda && window.AMLomda.hub,
  words: () => window.AMLomda && window.AMLomda.hub,
  drill: () => window.AMExam && window.AMExam.view,
  focus: () => window.AMExam && window.AMExam.view,
  play:  () => window.AMDrills && window.AMDrills.play,
  pat:   () => window.AMDrills && window.AMDrills.patterns,
  strat: () => window.AMStrat && window.AMStrat.view,
  prog:  () => window.AMProgress && window.AMProgress.view,
  about: () => window.AMAbout && window.AMAbout.view,
  more:  () => viewMore,
};

/* כל רינדור מקבל מכל חדש משלו. מסך שנבנה באסינכרוני (פרקים, התקדמות)
   ממשיך לכתוב לתוך המכל שלו גם אחרי שעברנו מסך — אבל המכל כבר מנותק
   מהדף, ולכן שום דבר לא דולף למסך אחר. */
function render() {
  spine(); nav();
  const v = $('#view');
  v.innerHTML = '';
  const box = el('div', 'screen');
  v.appendChild(box);
  if (!S.ready) { box.appendChild(skeleton(4)); return; }
  const fn = (VIEWS[S.view] || VIEWS.home)();
  if (!fn) { box.appendChild(skeleton(3)); return; }
  try { fn(box); } catch (e) {
    console.error(e);
    box.appendChild(state('משהו השתבש במסך הזה', 'ההתקדמות שמורה. נסה לחזור לבית.', { label: 'לבית', fn: () => go('home') }));
  }
}

/* שורת בחירה אחידה לכל התפריטים */
function tile(v, title, sub, fn, badge) {
  const b = el('button', 'tile');
  b.innerHTML = '<span class="tt">' + esc(title) +
    (badge ? ' <span class="pill good">' + esc(badge) + '</span>' : '') + '</span>' +
    (sub ? '<span class="ts">' + esc(sub) + '</span>' : '') +
    '<span class="chev" aria-hidden="true">‹</span>';
  b.onclick = fn;
  v.appendChild(b);
  return b;
}
function head(v, title, sub) {
  const h = el('div', 'phead');
  h.innerHTML = '<h1 class="page-title">' + esc(title) + '</h1>' + (sub ? '<p class="page-sub">' + sub + '</p>' : '');
  v.appendChild(h);
  return h;
}

/* ---------- טיפוגרפיה אנגלית ----------
   התגיות יושבות על <html>; ה-CSS דורס מהן את טוקני האנגלית. אותה
   פונקציה בדיוק רצה גם ב-index.html לפני הציור הראשון, כדי שלא
   יהיה הבזק של גודל ברירת המחדל. */
function applyTypo() {
  const r = document.documentElement;
  [['enSize', 'data-en-size']]
    .forEach(([k, attr]) => {
      const v = pref(k, '');
      v ? r.setAttribute(attr, v) : r.removeAttribute(attr);
      try { localStorage.setItem('amirnet.' + k, v); } catch (e) {}
    });
}

/* ---------- משטח לימוד משותף ---------- */
function openStudy(cardEl, o) {
  let box = $('#study');
  if (!box) { box = el('div', 'study'); box.id = 'study'; $('#layer').appendChild(box); }
  box.innerHTML = '';
  const bar = el('div', 'sbar');
  const x = el('button', 'x', '&times;');
  x.setAttribute('aria-label', 'סגירה');
  x.onclick = () => { closeStudy(); if (o.close) o.close(); };
  const prog = el('div', 'prog');
  const pi = el('i'); pi.style.width = (o.n ? (o.i / o.n * 100) : 0) + '%';
  prog.appendChild(pi);
  bar.append(x, prog, el('div', 'cnt', o.right != null ? o.right : (o.i + '/' + o.n)));
  box.append(bar, cardEl);
  return box;
}
function closeStudy() { const b = $('#study'); if (b) b.remove(); }

const examSentence = (s) => esc(s).replace(/_{2,}/g, '<b>______</b>');

/* קטע קריאה כ-HTML: פסקאות אמיתיות, וסימוני השורות של מאל"ו — (5),
   (10), (15) — מסומנים כמספרי שורה ולא כחלק מהמשפט. בלי זה הם
   נקראים כמו מספור אפשרויות בתוך הטקסט. */
function passageHTML(text) {
  return String(text).split(/\n{2,}/).map((para) =>
    '<p>' + esc(para.trim()).replace(/\((\d{1,2})\)/g, '<span class="pn">($1)</span>') + '</p>'
  ).join('');
}
function blankWord(sent, w) {
  const re = new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\w*', 'i');
  return esc(sent).replace(re, '<b>______</b>');
}
function highlight(sent, w) {
  const re = new RegExp('\\b(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\w*)', 'i');
  return esc(sent).replace(re, '<b>$1</b>');
}
function meaning(o, withEx) {
  /* העברית ראשונה: היא מה שהלומד מחפש בעין. ההגדרה והנרדפות מתחתיה. */
  return (o.he ? '<div class="he">' + esc(o.he) + '</div>' : '') +
    (o.pos ? '<div class="pos">' + esc(o.pos) + '</div>' : '') +
    (o.def ? '<div class="def">' + esc(o.def) + '</div>' : '') +
    (o.syn && o.syn.length ? '<div class="syn">' + o.syn.map(esc).join('  ·  ') + '</div>' : '') +
    (withEx && sentOf(o.w) ? '<div class="ex"><span class="ex-lab">from a real exam</span>' + highlight(sentOf(o.w), o.w) + '</div>' : '');
}

function editAssoc(w, done) {
  const o = S.words.get(w);
  const box = el('div', 'study'); box.style.zIndex = 70;
  const c = el('div', 'card');
  c.innerHTML = '<div class="mid"><div class="head-en">' + esc(o.w) + '</div>' + meaning(o, false) + '</div>';
  const f = el('div', 'acts');
  f.innerHTML = '<label class="f" for="ae">אסוציאציה חדשה</label>' +
    '<textarea class="t" id="ae" rows="2">' + esc(assoc(w)) + '</textarea>';
  const ok = el('button', 'btn', 'שמור');
  const no = el('button', 'btn ghost sm', 'ביטול');
  ok.onclick = () => {
    const val = $('#ae').value.trim();
    if (val.length < 3) { toast('קצר מדי'); return; }
    put('assoc', w, { text: val, at: Date.now() });
    const cd = card(w); if (cd) { cd.af = 0; cd.at = Date.now(); put('cards', w, cd); }
    box.dispatchEvent(new Event('am:close'));
    box.remove(); if (done) done();
  };
  no.onclick = () => { box.dispatchEvent(new Event('am:close')); box.remove(); if (done) done(); };
  f.append(ok, no);
  c.appendChild(f); box.appendChild(c);
  $('#layer').appendChild(box);
  setTimeout(() => {
    const t = $('#ae');
    if (!t) return;
    t.focus();
    /* ב-iOS המקלדת עולה מעל שכבה ב-position:fixed ומכסה בדיוק את
       השדה שזה עתה קיבל פוקוס. visualViewport הוא החלק שבאמת נראה,
       ולכן גלילה אליו מחזירה את התיבה מעל המקלדת. */
    const bring = () => t.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setTimeout(bring, 260);
    if (window.visualViewport) {
      const vv = window.visualViewport;
      const on = () => bring();
      vv.addEventListener('resize', on);
      box.addEventListener('am:close', () => vv.removeEventListener('resize', on));
    }
  }, 60);
}

function viewMore(v) {
  head(v, 'עוד');

  const links = el('div', 'sec list');
  tile(links, 'התקדמות', 'אומדן ציון, מגמה ודיוק לפי פרק', () => go('prog'));
  tile(links, 'אסטרטגיה', 'מה נמדד על 1,267 שאלות אמיתיות — ומה לא עובד', () => go('strat'));
  tile(links, 'תבניות הבנת הנקרא', 'שמונה תבניות ושתי מסגרות, לקרוא לפני', () => go('pat'));
  tile(links, 'איך זה עובד', 'המבחן בארבעה מספרים, ומה לעשות ביום רגיל', () => go('about'));
  v.appendChild(links);

  const s = el('div', 'sec');
  s.appendChild(el('span', 'eyebrow', 'הגדרות'));
  const card = el('div', 'panel');
  card.innerHTML =
    '<label class="f" for="exd">תאריך המבחן</label>' +
    '<input class="t" id="exd" type="date" value="' + S.exam + '">';
  $('#exd', card).onchange = (e) => {
    S.exam = e.target.value || EXAM_DEFAULT;
    setPref('exam', S.exam);
    toast('תאריך המבחן עודכן'); spine();
  };

  const seg = (label, opts, cur, onPick) => {
    const w = el('div', 'ctl');
    w.appendChild(el('span', 'f', esc(label)));
    const row = el('div', 'seg');
    opts.forEach(([val, txt]) => {
      const b = el('button', cur === val ? 'on' : '', esc(txt));
      b.onclick = () => onPick(val);
      row.appendChild(b);
    });
    w.appendChild(row);
    card.appendChild(w);
  };
  seg('ערכת נושא', [['auto', 'אוטומטי'], ['light', 'בהיר'], ['dark', 'כהה']], pref('theme', 'auto'), (m) => {
    setPref('theme', m);
    try { localStorage.setItem('amirnet.theme', m); } catch (e) {}
    const r = m === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : m;
    document.documentElement.setAttribute('data-theme', r);
    document.documentElement.setAttribute('data-theme-mode', m);
    render();
  });
  seg('גודל האנגלית', [['s', 'קטן'], ['', 'רגיל'], ['l', 'גדול'], ['xl', 'ענק']], pref('enSize', ''), (val) => {
    setPref('enSize', val); applyTypo(); render();
  });
  card.appendChild(el('div', 'sample',
    'Peanut butter was once <b>considered</b> a delicacy.'));
  s.appendChild(card);
  v.appendChild(s);

  const C = window.Cloud;
  const acc = el('div', 'sec');
  acc.appendChild(el('span', 'eyebrow', 'חשבון וסנכרון'));
  const ap = el('div', 'panel');
  if (!C || !C.enabled) {
    ap.appendChild(el('p', 'note', 'העותק הזה עובד מקומית בלבד. באתר עצמו אפשר להתחבר ולסנכרן בין מכשירים.'));
  } else if (!C.user) {
    ap.appendChild(el('p', 'note', 'התחבר עם Google כדי לסנכרן בין הטלפון למחשב ולפתוח את פרקי האמת.'));
    const b = el('button', 'btn', 'התחברות עם Google');
    b.onclick = () => C.login();
    ap.appendChild(b);
  } else {
    const st = C.status();
    ap.appendChild(el('p', 'note', 'מחובר כ‑<b>' + esc(C.user.email) + '</b><br>' +
      (st.syncing ? 'מסנכרן עכשיו…' : st.pending ? st.pending + ' שינויים ממתינים לשליחה' :
        st.lastSync ? 'מסונכרן · ' + new Date(st.lastSync).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : 'ממתין לסנכרון')));
    const sy = el('button', 'btn ghost', 'סנכרן עכשיו');
    sy.onclick = () => { C.syncNow && C.syncNow(); toast('מסנכרן…'); };
    const out = el('button', 'btn ghost', 'התנתקות');
    out.onclick = () => { if (confirm('להתנתק? ההתקדמות שמורה בענן.')) { flushNow(); C.logout(); } };
    ap.append(sy, out);
  }
  acc.appendChild(ap);
  v.appendChild(acc);

  const ob = el('button', 'btn ghost sm', 'הצג שוב את מסך הפתיחה');
  ob.onclick = () => window.AMOnboard && window.AMOnboard.replay();
  v.appendChild(ob);

  seedUI(v);
}

/* ================= חשבון וענן ================= */
function paintAccount() {
  const b = $('#acct'), sy = $('#sync');
  const C = window.Cloud;
  if (!C || !C.enabled) { b.hidden = true; sy.hidden = true; return; }
  b.hidden = false;
  if (C.user) {
    b.textContent = (C.user.firstName || 'החשבון שלי');
    b.className = 'acct in';
    b.onclick = () => go('more');
  } else {
    b.textContent = 'התחברות'; b.className = 'acct';
    b.onclick = () => C.login();
  }
  const st = C.status();
  sy.hidden = !st.pending && !st.syncing;
  sy.textContent = st.syncing ? 'מסנכרן…' : st.pending ? st.pending + ' ממתינות' : '';
}
['cloud:user', 'cloud:sync', 'cloud:merged', 'cloud:queued'].forEach((e) =>
  document.addEventListener(e, paintAccount));

/* ---------- המשפטים מהמבחן ----------
   הם תוכן של מאל"ו ולכן לא יושבים בקוד. בלעדיהם האפליקציה עובדת: הגדרה,
   סינונימים ותרגום נשארים מקומיים ואופליין — רק ההקשר האותנטי דורש רשת. */
async function loadSentences() {
  const C = window.Cloud;
  if (!C || !C.enabled || !C.user) return;
  try {
    const rows = await C.bank('sentence');
    if (!rows) return;
    rows.forEach((r) => S.sent.set(r.w, r.ex));
    if (!$('#study')) render();
  } catch (e) { /* בלי משפטים עדיין לומדים */ }
}
document.addEventListener('cloud:user', () => { if (S.ready) loadSentences(); });

/* ---------- זריעת בנק השאלות (חד-פעמי) ----------
   הקבצים נבחרים מהדיסק ונכתבים למסד. ה-RLS מתיר את זה לבעלים בלבד. */
function seedUI(v) {
  const C = window.Cloud;
  /* כלי תחזוקה של בעל האתר בלבד. ה-RLS ממילא חוסם כל אחד אחר, אז אין
     טעם להציג לו אותו. */
  if (!C || !C.enabled || !C.user || C.user.email !== OWNER) return;
  const sec = el('div', 'sec');
  sec.appendChild(el('span', 'eyebrow', 'בנק השאלות (מנהל)'));

  const have = S.sent.size;
  sec.appendChild(el('div', 'note',
    'מחובר כ‑<b>' + esc(C.user.email || '—') + '</b>.<br>' +
    (have ? 'הבנק טעון: ' + have + ' משפטי מבחן זמינים.'
          : 'הבנק ריק. בחר את חמשת הקבצים מתוך <b>data-private</b>.')));

  const inp = el('input');
  inp.type = 'file'; inp.multiple = true; inp.accept = 'application/json,.json';
  inp.className = 't';
  const out = el('div', 'note');
  const line = (html) => { const d = el('div', '', html); out.appendChild(d); return d; };

  const go = el('button', 'btn ghost', 'העלה למסד');
  go.onclick = async () => {
    if (!inp.files.length) { toast('לא נבחרו קבצים'); return; }
    go.disabled = true; out.innerHTML = '';
    const KIND = { 'sc.json': 'sc', 'rs.json': 'rs', 'rc.json': 'rc',
                   'passages.json': 'passage', 'sentences.json': 'sentence' };
    for (const f of inp.files) {
      const kind = KIND[f.name];
      if (!kind) { line('· ' + esc(f.name) + ' — שם לא מוכר, דילגתי'); continue; }
      const row = line('· ' + esc(f.name) + ' — קורא…');
      try {
        const rows = JSON.parse(await f.text());
        if (!Array.isArray(rows)) throw new Error('הקובץ אינו רשימה');
        const r = await C.seedBank(kind, rows, (n, tot) => {
          row.innerHTML = '· ' + esc(f.name) + ' — ' + n + '/' + tot;
        });
        row.innerHTML = r.ok
          ? '· ' + esc(f.name) + ' — ✅ ' + r.n
          : '· ' + esc(f.name) + ' — ❌ ' + esc(r.reason);
      } catch (e) {
        row.innerHTML = '· ' + esc(f.name) + ' — ❌ ' + esc(String((e && e.message) || e));
      }
    }
    go.disabled = false;
    await loadSentences();
  };
  sec.append(inp, go, out);
  v.appendChild(sec);
}

/* ================= טעינה ================= */
async function boot() {
  render();
  try {
    const words = await fetch('data/words.json').then((r) => r.json());
    words.forEach((o) => S.words.set(o.w, o));
  } catch (e) {
    $('#view').innerHTML = '<div class="empty">לא הצלחתי לטעון את המאגר. רענן את הדף.</div>';
    return;
  }
  S.exam = pref('exam', EXAM_DEFAULT);
  applyTypo();
  if (!pref('start', null)) setPref('start', today());
  S.ready = true;
  render();

  /* הענן לפני am:ready: מסך הפתיחה צריך לדעת אם המשתמש מחובר, אחרת
     מכשיר חדש של משתמש ותיק היה מקבל שוב פתיחה ומבחן רמה לפני שהמיזוג
     הספיק להביא את ההתקדמות שלו. init חסום ב-1.5 שניות. */
  if (window.Cloud && window.Cloud.enabled) { try { await window.Cloud.init(); } catch (e) {} }
  paintAccount();
  /* אירוע ולא קריאה ישירה: onboard.js נטען אחרי app.js, ועל השרת החי
     ה-await כאן יכול לחזור לפני שהוא רץ. */
  S.fired = true;
  document.dispatchEvent(new CustomEvent('am:ready'));
  render();   // המסכים שנטענו אחרי app.js מוכנים עכשיו
  loadSentences();

  const brand = $('#brand');
  if (brand) brand.onclick = () => go('home');

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    /* שירות עובד חדש משתלט תוך כדי הטעינה הראשונה שאחרי פריסה, אבל
       הדף שכבר נצבע הוגש מהגרסה הישנה — כלומר עדכון נראה רק בטעינה
       השנייה. רענון אחד ופעם אחת סוגר את זה. לא באמצע פרק: שם רענון
       היה מוחק שעון רץ ותשובות שטרם נסגרו. */
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded || !navigator.serviceWorker.controller) return;
      if ($('#study')) { toast('יש גרסה חדשה. תיכנס לתוקף בפתיחה הבאה.'); return; }
      reloaded = true;
      location.reload();
    });
  }
}

/* ---------- מה שהחלק השני של האפליקציה צריך ----------
   drills.js נשען על אותם כלים ואותו אחסון; שכפול שלהם היה מייצר שני
   מקורות אמת למצב הלומד. */
window.AM = {
  el, esc, clamp, shuffle, toast, render, go, openStudy, closeStudy,
  today, addDays, between, heDate, iso, isOff, isShabbat, isHalf, studyDaysLeft,
  ns, put, pref, setPref, bump, day, streak, card, assoc, sentOf, bucket, gradeWord,
  S, dueList, newList, meaning, examSentence, passageHTML, highlightWord: highlight, blankWord,
  editAssoc, markKnown,
  state, skeleton, buzz, plural, applyTypo, tile, head, flushNow,
  async bank(kind) {
    if (S.bank[kind]) return S.bank[kind];
    const C = window.Cloud;
    if (!C || !C.enabled || !C.user) return null;
    const rows = await C.bank(kind);
    S.bank[kind] = rows || [];
    return S.bank[kind];
  },
};

window.addEventListener('pagehide', flushNow);
document.addEventListener('visibilitychange', () => { if (document.hidden) flushNow(); });

boot();

})();
