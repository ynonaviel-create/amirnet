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

/* ================= FSRS 4.5 =================
   מותאם למבחן בשתי נקודות: יעד הזכירה עולה ככל שמתקרבים, ואף כרטיס לא
   מתוזמן לתאריך שאחרי הבחינה. */
const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474,
           0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5, FACTOR = Math.pow(0.9, 1 / DECAY) - 1;
const retr = (t, S) => Math.pow(1 + FACTOR * t / S, DECAY);
const ivl  = (S, req) => S / FACTOR * (Math.pow(req, 1 / DECAY) - 1);
const initD = (g) => clamp(W[4] - (g - 3) * W[5], 1, 10);
const nextD = (D, g) => clamp(W[7] * initD(4) + (1 - W[7]) * (D - W[6] * (g - 3)), 1, 10);

function nextS(D, S, r, g) {
  if (g === 1) return clamp(W[11] * Math.pow(D, -W[12]) * (Math.pow(S + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)), 0.1, S);
  const hard = g === 2 ? W[15] : 1, easy = g === 4 ? W[16] : 1;
  return clamp(S * (1 + Math.exp(W[8]) * (11 - D) * Math.pow(S, -W[9]) *
    (Math.exp(W[10] * (1 - r)) - 1) * hard * easy), 0.1, 36500);
}

function retention() {
  const left = between(today(), S.exam);
  if (left <= 12) return 0.94;
  if (left <= 25) return 0.92;
  return 0.90;
}

function previewDays(c, g) {
  if (g === 1) return 1;
  const t = c.last ? Math.max(0, between(c.last, today())) : 0;
  const st = (c.r > 0 && c.st) ? nextS(c.dd, c.st, retr(t, c.st), g) : clamp(W[g - 1], 0.1, 36500);
  return clamp(Math.round(ivl(st, retention())), 1, 400);
}

function schedule(c, g) {
  const t = c.last ? Math.max(0, between(c.last, today())) : 0;
  if (c.r > 0 && c.st) {
    const r = retr(t, c.st);
    c.st = nextS(c.dd, c.st, r, g);
    c.dd = nextD(c.dd, g);
  } else {
    c.st = clamp(W[g - 1], 0.1, 36500);
    c.dd = initD(g);
  }
  c.r = (c.r || 0) + 1;
  if (g === 1) c.l = (c.l || 0) + 1;
  c.last = today();
  c.d = addDays(today(), g === 1 ? 1 : clamp(Math.round(ivl(c.st, retention())), 1, 400));
  /* מהדק המבחן: מילה שאמורה לחזור אחרי הבחינה תחזור ביום הבחינה. */
  const left = between(today(), S.exam);
  if (left > 0 && between(today(), c.d) > left) c.d = S.exam;
  c.at = Date.now();
  return c;
}

const bucket = (c) => !c ? 'new' : (!c.st || c.st < 7) ? 'young' : c.st < 30 ? 'solid' : 'strong';

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
  if (window.Cloud && window.Cloud.enabled) window.Cloud.queue(n, k, v);
}
const pref = (k, d) => (k in ns('prefs') ? ns('prefs')[k] : d);
const setPref = (k, v) => put('prefs', k, v);

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
const dailyNew = () => pref('newPerDay', 35);

function dueList() {
  const t = today(), out = [];
  const cs = ns('cards');
  for (const w in cs) if (cs[w].d && cs[w].d <= t) out.push(w);
  return out.sort((a, b) => (cs[a].d < cs[b].d ? -1 : 1));
}
const priOf = (w) => ns('prefs')['pri.' + w] || 3;

function newList() {
  const out = [], cs = ns('cards');
  S.words.forEach((o, w) => { if (!cs[w]) out.push(w); });
  return out.sort((a, b) => priOf(a) - priOf(b) ||
    (S.words.get(b).n || 1) - (S.words.get(a).n || 1) ||
    (a < b ? -1 : 1));
}
function untriaged() {
  const out = [], cs = ns('cards');
  S.words.forEach((o, w) => { if (!cs[w] && priOf(w) === 3) out.push(w); });
  return out;
}
function plan() {
  const d = day();
  const due = dueList(), fresh = newList();
  return {
    due, fresh,
    dueN: Math.min(due.length, 160),
    newN: Math.min(fresh.length, Math.max(0, dailyNew() - d.new)),
  };
}

/* ---------- סימון "כבר יודע" ----------
   נכנס כקלף בוגר במקום להילמד, ובזכות מהדק המבחן עדיין יחזור פעם אחת
   לאימות לפני 22.10. זה מה שמונע בזבוז ימים על מה שכבר בראש. */
function markKnown(w) {
  const c = { r: 1, l: 0, st: 60, dd: 4, known: 1, last: today(), d: addDays(today(), 60), at: Date.now() };
  const left = between(today(), S.exam);
  if (left > 0 && between(today(), c.d) > left) c.d = S.exam;
  put('cards', w, c);
}

/* ================= תצוגה ================= */
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
  ['drill', 'תרגול',  '◆'],
  ['play',  'משחקים', '✦'],
  ['more',  'עוד',    '≡'],
];
function nav() {
  const n = $('#nav');
  if (!S.ready) { n.hidden = true; return; }
  n.hidden = false; n.innerHTML = '';
  /* 'fix' הוא מסך-בן של הבית ולא לשונית בפני עצמה; בלי זה שום לשונית
     לא מסומנת שם ולא ברור איפה נמצאים. */
  const at = S.view === 'fix' ? 'home' : S.view;
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
  ({ home: viewHome, strat: viewStrat, drill: viewDrill, play: viewPlay, fix: viewFix, more: viewMore }[S.view] || viewHome)(v);
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

/* ---------- מיון מהיר ---------- */
let TRI = null;
function startTriage(limit) {
  const q = untriaged();
  if (!q.length) { toast('כל המאגר כבר ממוין'); return; }
  /* המיון מוגש באצוות. 1,600 מילים ברצף הן שעה וחצי ולכן לא ייעשו;
     מאה ועשרים הן שש דקות ולכן כן. */
  TRI = { q: shuffle(q).slice(0, limit || q.length), i: 0, known: 0 };
  paintTriage();
}
function paintTriage() {
  if (TRI.i >= TRI.q.length) { closeStudy(); toast('המיון הסתיים'); TRI = null; render(); return; }
  const w = TRI.q[TRI.i], o = S.words.get(w);
  const c = el('div', 'card');
  const mid = el('div', 'mid',
    '<span class="eyebrow">מיון מהיר · ' + (TRI.i + 1) + ' מתוך ' + TRI.q.length + '</span>' +
    '<div class="head-en">' + esc(o.w) + '</div>' +
    '<div class="tiny dim">יודע מה זה אומר, בלי להסס?</div>');
  const acts = el('div', 'acts');
  const g = el('div', 'grades g3');
  const mark = (pri, known) => {
    if (known) { markKnown(w); TRI.known++; } else setPref('pri.' + w, pri);
    TRI.i++; paintTriage();
  };
  [['לא יודע', 'g1', () => mark(1, false)],
   ['לא בטוח', '',   () => mark(2, false)],
   ['יודע', 'g3',    () => mark(3, true)]].forEach(([t, cl, fn]) => {
    const b = el('button', 'grade ' + cl, esc(t)); b.onclick = fn; g.appendChild(b);
  });
  acts.appendChild(g);
  if (sentOf(w)) {
    const peek = el('button', 'btn ghost sm', 'הצג את המשפט שבו הופיעה');
    peek.onclick = () => { peek.remove(); mid.appendChild(el('div', 'ex', highlight(sentOf(w), w))); };
    acts.appendChild(peek);
  }
  c.append(mid, acts);
  openStudy(c, { i: TRI.i, n: TRI.q.length, right: TRI.known + ' ידועות',
                 close: () => { TRI = null; render(); } });
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

/* ---------- תרגול אוצר מילים ---------- */
let SESS = null;
function startStudy() {
  const p = plan();
  const rev = p.due.slice(0, p.dueN).map((w) => ({ w, kind: 'recall' }));
  const nw  = p.fresh.slice(0, p.newN).map((w) => ({ w, kind: 'intro' }));
  shuffle(rev);
  const q = []; let k = 0;
  for (let i = 0; i < rev.length; i++) {
    q.push(rev[i]);
    if (k < nw.length && (i + 1) % 5 === 0) q.push(nw[k++]);
  }
  while (k < nw.length) q.push(nw[k++]);
  if (!q.length) { toast('אין כרטיסים להיום'); return; }
  SESS = { q, i: 0, done: 0, ok: 0, again: [], t0: Date.now() };
  paintCard();
}
function nextCard() {
  SESS.i++;
  if (SESS.i >= SESS.q.length && SESS.again.length) SESS.q = SESS.q.concat(SESS.again.splice(0));
  if (SESS.i >= SESS.q.length) return finish();
  paintCard();
}
function paintCard() {
  const it = SESS.q[SESS.i];
  SESS.usedAssoc = false;
  (it.kind === 'intro' ? cardIntro : cardRecall)(it.w);
}
function endSession() {
  const secs = Math.round((Date.now() - SESS.t0) / 1000);
  if (secs > 0) bump({ sec: secs });
  SESS = null; closeStudy(); render();
}

function cardIntro(w) {
  const o = S.words.get(w);
  const c = el('div', 'card');
  const mid = el('div', 'mid',
    '<span class="eyebrow">מילה חדשה</span>' +
    '<div class="head-en">' + esc(o.w) + '</div>' + meaning(o, true));
  const acts = el('div', 'acts');
  acts.innerHTML =
    '<label class="f" for="ain">כתוב אסוציאציה משלך — צליל, תמונה, סיפור. בלי זה המילה לא נכנסת.</label>' +
    '<textarea class="t" id="ain" rows="2" placeholder="למשל: abandon &rarr; &quot;אבן-דון&quot; — עזבו אותו מוטל כמו אבן בדרך"></textarea>';
  const save = el('button', 'btn', 'שמור והמשך');
  save.onclick = () => {
    const val = $('#ain').value.trim();
    if (val.length < 3) { toast('קודם אסוציאציה — אפילו קצרה'); $('#ain').focus(); return; }
    put('assoc', w, { text: val, at: Date.now() });
    put('cards', w, { r: 0, l: 0, at: Date.now(), added: today() });
    bump({ new: 1 });
    SESS.q.splice(SESS.i + 1, 0, { w, kind: 'recall' });   // נבדק מיד, ושוב בהמשך
    nextCard();
  };
  const row = el('div', 'hints');
  const kn = el('button', 'hint', 'כבר יודע — דלג');
  kn.onclick = () => { markKnown(w); toast('סומן כידוע'); nextCard(); };
  row.appendChild(kn);
  acts.append(save, row);
  c.append(mid, acts);
  openStudy(c, { i: SESS.i, n: SESS.q.length, close: endSession });
  setTimeout(() => { const t = $('#ain'); if (t) t.focus(); }, 60);
}

function cardRecall(w) {
  const o = S.words.get(w), a = assoc(w);
  const c = el('div', 'card');
  const mid = el('div', 'mid',
    '<div class="head-en">' + esc(o.w) + '</div>' + (o.pos ? '<div class="pos">' + esc(o.pos) + '</div>' : ''));
  const zone = el('div', 'mid'); zone.style.flex = '0';
  const acts = el('div', 'acts');

  const ladder = el('div', 'hints');
  const bA = el('button', 'hint', 'האסוציאציה שלי');
  const bE = el('button', 'hint', 'המשפט');
  bA.disabled = !a; bE.disabled = !sentOf(w);
  bA.onclick = () => { SESS.usedAssoc = true; bA.disabled = true;
    zone.appendChild(el('div', 'assoc', '<span class="eyebrow">האסוציאציה שלך</span>' + esc(a))); };
  /* ברמז מסתירים את המילה עצמה, אחרת הרמז הוא התשובה */
  bE.onclick = () => { bE.disabled = true; zone.appendChild(el('div', 'ex', blankWord(sentOf(w), w))); };
  ladder.append(bA, bE);

  const show = el('button', 'btn', 'הצג תשובה');
  show.onclick = reveal;
  acts.append(ladder, show);

  function reveal() {
    zone.innerHTML = ''; acts.innerHTML = '';
    mid.innerHTML = '<div class="head-en">' + esc(o.w) + '</div>' + meaning(o, true) +
      (a ? '<div class="assoc"><span class="eyebrow">האסוציאציה שלך</span>' + esc(a) + '</div>' : '');
    const cur = card(w) || { r: 0 };
    const g = el('div', 'grades');
    [[1, 'שכחתי', 'g1'], [2, 'בקושי', ''], [3, 'ידעתי', 'g3'], [4, 'קל', '']].forEach(([n, t, cl]) => {
      const b = el('button', 'grade ' + cl,
        esc(t) + '<small>' + (n === 1 ? 'מחר' : previewDays(cur, n) + 'י') + '</small>');
      b.onclick = () => grade(w, n);
      g.appendChild(b);
    });
    acts.appendChild(g);
    const ed = el('button', 'btn ghost sm', a ? 'האסוציאציה לא עובדת — לכתוב חדשה' : 'להוסיף אסוציאציה');
    ed.onclick = () => editAssoc(w, reveal);
    acts.appendChild(ed);
  }
  c.append(mid, zone, acts);
  openStudy(c, { i: SESS.i, n: SESS.q.length, close: endSession });
}

function grade(w, g) {
  const c = card(w) || { r: 0, l: 0 };
  schedule(c, g);
  /* האם האסוציאציה הצילה? זו לולאת המשוב שמזינה את המעבדה. */
  if (g === 1 && SESS.usedAssoc) c.af = (c.af || 0) + 1;
  if (g >= 3 && SESS.usedAssoc) c.ah = (c.ah || 0) + 1;
  put('cards', w, c);
  bump({ rev: 1, ok: g >= 3 ? 1 : 0 });
  SESS.done++; if (g >= 3) SESS.ok++;
  if (g === 1) SESS.again.push({ w, kind: 'recall' });
  nextCard();
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
    box.remove(); if (done) done();
  };
  no.onclick = () => { box.remove(); if (done) done(); };
  f.append(ok, no);
  c.appendChild(f); box.appendChild(c);
  $('#layer').appendChild(box);
  setTimeout(() => { const t = $('#ae'); if (t) t.focus(); }, 60);
}

function finish() {
  const acc = SESS.done ? Math.round(SESS.ok / SESS.done * 100) : 0;
  const c = el('div', 'card');
  c.innerHTML = '<div class="mid"><span class="eyebrow">סיימת</span>' +
    '<div class="head-en">' + SESS.done + '</div>' +
    '<div class="he">כרטיסים · ' + acc + '% דיוק</div>' +
    '<div class="tiny dim">רצף של ' + Math.max(1, streak()) + ' ימים</div></div>';
  const a = el('div', 'acts');
  const b = el('button', 'btn', 'חזרה למסך הבית');
  b.onclick = endSession;
  a.appendChild(b); c.appendChild(a);
  openStudy(c, { i: 1, n: 1, right: '', close: endSession });
}

/* ---------- מעבדת אסוציאציות ---------- */
/* ---------- מסכים שמוגשים על ידי הקבצים האחרים ---------- */
function viewStrat(v) {
  if (window.AMStrat) return window.AMStrat.view(v);
  v.appendChild(el('div', 'empty', 'טוען…'));
}
function viewDrill(v) {
  if (window.AMDrills) return window.AMDrills.menu(v);
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
    '<label class="f" for="npd">מילים חדשות ביום</label>' +
    '<input class="t mono" id="npd" type="number" min="0" max="120" value="' + dailyNew() + '">' +
    '<label class="f" for="exd" style="margin-top:10px">תאריך המבחן</label>' +
    '<input class="t mono" id="exd" type="date" value="' + S.exam + '">';
  const save = el('button', 'btn ghost', 'עדכן');
  save.onclick = () => {
    setPref('newPerDay', clamp(parseInt($('#npd').value, 10) || 0, 0, 120));
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
  v.append(s, th);
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
  if (!pref('start', null)) setPref('start', today());
  S.ready = true;
  render();

  if (window.Cloud && window.Cloud.enabled) { try { await window.Cloud.init(); } catch (e) {} }
  paintAccount();
  loadSentences();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

/* ---------- מה שהחלק השני של האפליקציה צריך ----------
   drills.js נשען על אותם כלים ואותו אחסון; שכפול שלהם היה מייצר שני
   מקורות אמת למצב הלומד. */
window.AM = {
  el, esc, clamp, shuffle, toast, render, go, openStudy, closeStudy,
  today, addDays, between, heDate, iso, isOff, isShabbat, isHalf, studyDaysLeft,
  ns, put, pref, setPref, bump, day, streak, card, assoc, sentOf, schedule, bucket,
  S, dueList, newList, meaning, examSentence, highlightWord: highlight, blankWord,
  plan, untriaged, startTriage, startStudy, editAssoc,
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
