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
   שדרכן שאר הקבצים (בליץ, הדפסה, מסך המילים) מדברים איתו. */
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

document.addEventListener('cloud:merged', () => {
  flushNow();
  Object.keys(cache).forEach((k) => delete cache[k]);
  S.exam = pref('exam', EXAM_DEFAULT);
  render();
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

function spine() {
  const box = $('#spine');
  if (!S.ready) { box.hidden = true; return; }
  box.hidden = false;
  const left = Math.max(0, between(today(), S.exam));
  $('#dLeft').textContent = left;
  $('#dDate').textContent = heDate(S.exam);
  const start = pref('start', today());
  const span = Math.max(1, between(start, S.exam));
  const passed = clamp(between(start, today()), 0, span);
  const r = $('#ruler');
  r.innerHTML = '';
  for (let i = 0; i <= span; i++) {
    const d = addDays(start, i);
    const cls = i === passed ? 'today' : i < passed ? 'past' : isOff(d) ? 'off' : '';
    const tick = el('i', 'tick' + (cls ? ' ' + cls : ''));
    tick.title = heDate(d) + (HOLIDAYS[d] ? ' — ' + HOLIDAYS[d] : isShabbat(d) ? ' — שבת' : '');
    r.appendChild(tick);
  }
}

const NAV = [
  ['home',  'בית',    '◧'],
  ['strat', 'אסטרטגיה', '⊘'],
  ['drill', 'פרקים',  '◆'],
  ['words', 'מילים',  '✦'],
  ['more',  'עוד',    '≡'],
];
function nav() {
  const n = $('#nav');
  if (!S.ready) { n.hidden = true; return; }
  n.hidden = false; n.innerHTML = '';
  /* 'fix' הוא מסך-בן של הבית ולא לשונית בפני עצמה; בלי זה שום לשונית
     לא מסומנת שם ולא ברור איפה נמצאים. */
  const at = S.view === 'fix' ? 'home' : S.view === 'print' || S.view === 'prog' || S.view === 'play' || S.view === 'about' ? 'more'
    : S.view === 'focus' || S.view === 'pat' ? 'drill' : S.view;
  NAV.forEach(([k, t, ic]) => {
    const b = el('button', at === k ? 'on' : '', '<span class="ic">' + ic + '</span>' + t);
    b.onclick = () => go(k);
    n.appendChild(b);
  });
}
function go(v) { S.view = v; render(); window.scrollTo(0, 0); }

function render() {
  spine(); nav();
  const v = $('#view');
  v.innerHTML = '';
  if (!S.ready) { v.appendChild(el('div', 'empty', 'טוען…')); return; }
  ({ home: viewHome, strat: viewStrat, drill: viewDrill, play: viewPlay, fix: viewFix, print: viewPrint, prog: viewProg, focus: viewFocus, words: viewWords, pat: viewPat, about: viewAbout, more: viewMore }[S.view] || viewHome)(v);
}

/* ---------- בית ---------- */
function viewHome(v) {
  if (window.AMToday) return window.AMToday.home(v);
  v.appendChild(el('div', 'empty', 'טוען…'));
}
function viewFix(v) {
  if (window.AMToday) return window.AMToday.fix(v);
  v.appendChild(el('div', 'empty', 'טוען…'));
}
function viewPrint(v) {
  if (window.AMPrint) return window.AMPrint.view(v);
  v.appendChild(el('div', 'empty', 'טוען…'));
}
function viewProg(v) {
  if (window.AMProgress) return window.AMProgress.view(v);
  v.appendChild(el('div', 'empty', 'טוען…'));
}
function viewWords(v) {
  if (window.AMWords) return window.AMWords.view(v);
  v.appendChild(el('div', 'empty', 'טוען…'));
}
function viewAbout(v) {
  if (window.AMAbout) return window.AMAbout.view(v);
  v.appendChild(el('div', 'empty', 'טוען…'));
}

/* ---------- טיפוגרפיה אנגלית ----------
   התגיות יושבות על <html>; ה-CSS דורס מהן את טוקני האנגלית. אותה
   פונקציה בדיוק רצה גם ב-index.html לפני הציור הראשון, כדי שלא
   יהיה הבזק של גודל ברירת המחדל. */
function applyTypo() {
  const r = document.documentElement;
  [['enSize', 'data-en-size'], ['enFace', 'data-en-face'], ['enLead', 'data-en-lead']]
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
  return (o.pos ? '<div class="pos">' + esc(o.pos) + '</div>' : '') +
    (o.def ? '<div class="def">' + esc(o.def) + '</div>' : '') +
    (o.syn && o.syn.length ? '<div class="syn">' + o.syn.map(esc).join('  ·  ') + '</div>' : '') +
    (o.he ? '<div class="he">' + esc(o.he) + '</div>' : '') +
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

/* ---------- מעבדת אסוציאציות ---------- */
/* ---------- מסכים שמוגשים על ידי הקבצים האחרים ---------- */
function viewStrat(v) {
  if (window.AMStrat) return window.AMStrat.view(v);
  v.appendChild(el('div', 'empty', 'טוען…'));
}
function viewDrill(v) {
  if (window.AMExam) return window.AMExam.view(v);
  v.appendChild(el('div', 'empty', 'טוען…'));
}
function viewFocus(v) {
  if (window.AMDrills) return window.AMDrills.menu(v);
  v.appendChild(el('div', 'empty', 'טוען…'));
}
function viewPat(v) {
  if (window.AMDrills) return window.AMDrills.patterns(v);
  v.appendChild(el('div', 'empty', 'טוען…'));
}
function viewPlay(v) {
  if (window.AMDrills) return window.AMDrills.play(v);
  v.appendChild(el('div', 'empty', 'טוען…'));
}

function viewMore(v) {
  const s = el('div', 'sec');
  s.appendChild(el('span', 'eyebrow', 'כיול'));
  const row = el('div');
  row.innerHTML =
    '<label class="f" for="exd">תאריך המבחן</label>' +
    '<input class="t mono" id="exd" type="date" value="' + S.exam + '">';
  const save = el('button', 'btn ghost', 'עדכן');
  save.onclick = () => {
    S.exam = $('#exd').value || EXAM_DEFAULT;
    setPref('exam', S.exam);
    toast('עודכן'); render();
  };
  s.append(row, save);

  const th = el('div', 'sec');
  th.appendChild(el('span', 'eyebrow', 'תצוגה'));
  const modes = [['auto', 'אוטומטי'], ['light', 'בהיר'], ['dark', 'כהה']];
  const g = el('div', 'grades g3');
  modes.forEach(([m, t]) => {
    const b = el('button', 'grade' + (pref('theme', 'auto') === m ? ' g3' : ''), esc(t));
    b.onclick = () => {
      setPref('theme', m);
      try { localStorage.setItem('amirnet.theme', m); } catch (e) {}
      const r = m === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : m;
      document.documentElement.setAttribute('data-theme', r);
      document.documentElement.setAttribute('data-theme-mode', m);
      render();
    };
    g.appendChild(b);
  });
  th.appendChild(g);

  /* ---- שליטה בטיפוגרפיה האנגלית ----
     כל תוכן המבחן הוא אנגלית, וטיפוגרפיה טובה היא לא אותו דבר לכל
     עין ולכל מסך. שלושה בוררים, ודוגמית שמשתנה מתחתיהם מיד. */
  const TYPO = [
    ['enSize', 'גודל', [['s', 'קטן'], ['', 'רגיל'], ['l', 'גדול'], ['xl', 'ענק']]],
    ['enFace', 'גופן', [['', 'סריף'], ['sans', 'סאנס'], ['exam', 'כמו במבחן']]],
    ['enLead', 'רווח שורה', [['tight', 'צפוף'], ['', 'רגיל'], ['loose', 'רחב']]],
  ];
  const sample = el('div', 'sample',
    'Peanut butter was once <b>considered</b> a delicacy and served ' +
    'only in the finest restaurants.');

  TYPO.forEach(([key, label, opts]) => {
    const wrap = el('div', 'ctl');
    wrap.appendChild(el('span', 'f', esc(label)));
    const row = el('div', 'grades');
    row.style.gridTemplateColumns = 'repeat(' + opts.length + ',1fr)';
    const cur = pref(key, '');
    opts.forEach(([val, txt]) => {
      const b = el('button', 'grade' + (cur === val ? ' g3' : ''), esc(txt));
      b.onclick = () => { setPref(key, val); applyTypo(); render(); };
      row.appendChild(b);
    });
    wrap.appendChild(row);
    th.appendChild(wrap);
  });
  th.appendChild(sample);
  const reset = el('button', 'btn ghost sm', 'אפס לברירת המחדל');
  reset.onclick = () => { ['enSize', 'enFace', 'enLead'].forEach((k) => setPref(k, '')); applyTypo(); render(); };
  th.appendChild(reset);

  const pr = el('div', 'sec');
  pr.appendChild(el('span', 'eyebrow', 'עוד מסכים'));
  const pb = el('button', 'btn ghost');
  pb.style.cssText = 'text-align:right;padding:14px';
  pb.innerHTML = '<div style="font-weight:700;font-size:var(--fs-md);color:var(--text)">הדפסה</div>' +
    '<div class="tiny muted" style="font-weight:400;margin-top:2px">טווח, מקור ושלוש פריסות — עם תצוגה מקדימה וספירת עמודים.</div>';
  pb.onclick = () => go('print');
  pr.appendChild(pb);

  const pg = el('button', 'btn ghost');
  pg.style.cssText = 'text-align:right;padding:14px;margin-top:6px';
  pg.innerHTML = '<div style="font-weight:700;font-size:var(--fs-md);color:var(--text)">התקדמות</div>' +
    '<div class="tiny muted" style="font-weight:400;margin-top:2px">אומדן ציון, מגמה, דיוק לפי פרק, ומפת המלכודות שלך.</div>';
  pg.onclick = () => go('prog');
  pr.appendChild(pg);

  const ab = el('button', 'btn ghost');
  ab.style.cssText = 'text-align:right;padding:14px;margin-top:6px';
  ab.innerHTML = '<div style="font-weight:700;font-size:var(--fs-md);color:var(--text)">מה זה, ואיך משתמשים</div>' +
    '<div class="tiny muted" style="font-weight:400;margin-top:2px">המבחן בארבעה מספרים, חמשת המסכים, ומה לעשות ביום רגיל.</div>';
  ab.onclick = () => go('about');
  pr.appendChild(ab);

  const gm = el('button', 'btn ghost');
  gm.style.cssText = 'text-align:right;padding:14px;margin-top:6px';
  gm.innerHTML = '<div style="font-weight:700;font-size:var(--fs-md);color:var(--text)">משחקים</div>' +
    '<div class="tiny muted" style="font-weight:400;margin-top:2px">רביעיות · מגדל המילים · זוגות מבלבלים · בליץ 90.</div>';
  gm.onclick = () => go('play');
  pr.appendChild(gm);

  const kb = el('div', 'sec');
  kb.appendChild(el('span', 'eyebrow', 'מקלדת'));
  kb.appendChild(el('p', 'note',
    '<b class="rng">1–4</b> בוחרות אפשרות או דרגה · <b>Enter</b> ממשיכה · <b>Esc</b> סוגרת. ' +
    'שימושי כשמתרגלים מהמחשב.'));
  const ob = el('button', 'btn ghost sm', 'הצג שוב את מסך הפתיחה');
  ob.onclick = () => window.AMOnboard && window.AMOnboard.replay();
  kb.appendChild(ob);

  v.append(s, th, pr, kb);
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
    b.onclick = () => { if (confirm('להתנתק?')) C.logout(); };
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
  const sec = el('div', 'sec');
  sec.appendChild(el('span', 'eyebrow', 'בנק השאלות'));

  /* אבחון במקום כישלון שקט: אם משהו חוסם, שיהיה כתוב מה. */
  if (!C || !C.enabled) {
    sec.appendChild(el('div', 'note', 'הענן כבוי בעותק הזה. פתח את האתר בכתובת האמיתית.'));
    v.appendChild(sec); return;
  }
  if (!C.user) {
    sec.appendChild(el('div', 'note', 'צריך להתחבר קודם — הכפתור למעלה מימין.'));
    v.appendChild(sec); return;
  }

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
  /* האירוע הזה, ולא קריאה ישירה ל-AMOnboard.start. boot() רץ בסוף
     app.js, בעוד onboard.js נטען אחריו — ועל השרת החי, שבו שירות
     העובד מגיש את המילון מהמטמון, ה-await חוזר לפני ששאר קבצי
     ה-script בכלל התחילו לרוץ. התוצאה הייתה שמסך הכניסה הראשונה
     לא נפתח בדיוק במקום היחיד שבו הוא חשוב. */
  document.dispatchEvent(new CustomEvent('am:ready'));

  if (window.Cloud && window.Cloud.enabled) { try { await window.Cloud.init(); } catch (e) {} }
  paintAccount();
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
  state, skeleton, buzz, plural, applyTypo,
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
