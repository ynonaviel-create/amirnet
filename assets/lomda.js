/* ================= אמירנט — הלומדה =================

   מחליפה את FSRS ואת המיון המהיר. העיקרון: הלומד לא מחליט מה לעשות.
   יש כפתור אחד, "המשך", והמערכת בוחרת — מבחן רמה, סינון, שינון או
   תרגול — לפי מה שיש על השולחן.

   המאגר מחולק לרמות של 200 לפי תדירות בשפה (data/words.json, שדה lv).
   רמה נמוכה = מילה נפוצה = חשובה יותר לציון.

   מצב מילה (ns 'cards'):
     { v:2, s, box, streak, sd, hot, r, l, d, last, at }
     s:  known  — סומנה "יודע" בסינון
         learn  — סומנה "לא יודע", ממתינה לשינון
         drill  — שוננה ועברה מבדק, בסבב התרגול
         master — נזכרה ברצף ושוחררה
     מילה בלי כרטיס היא new, או placed אם היא ברמה שמתחת לרמת הכניסה.
     placed לא נשמרת ככרטיס: אלף כרטיסים כאלה היו אלף פעולות בתור הענן.

   d / l / r נשארו בשמות של FSRS, כי מסך המילים ובנק הטעויות
   קוראים אותם: d = תאריך פירעון, l = נפילות, r = חזרות.
   ============================================================== */
'use strict';

(function () {

const A = window.AM;
const { el, esc, toast, ns, put, pref, setPref, card, assoc, S, shuffle,
        today, addDays, between, bump, openStudy, closeStudy, buzz } = A;

/* ---------- כיול ---------- */
const TEST_N      = 10;     // מילים לרמה במבחן הרמה
const TEST_PASS   = 0.9;    // 9 מתוך 10. טעות אחת או שתיים = צריך ללמוד את הרמה
const RED_BATCH   = 8;      // כמה "לא יודע" לפני שעוברים לשינון
const FILTER_MAX  = 40;     // תקרת מילים לסבב סינון אחד
const PRACTICE_N  = 15;
const INTERVALS   = [0, 1, 2, 4, 8, 16];
const MASTER_RUN  = 4;      // נכונות ברצף לשחרור
const HOT         = 3;      // כמה תרגולים מילה שנשכחה נשארת "חמה"
const ROUNDS_GOAL = 4;

/* ---------- מצב ---------- */
const words = () => {
  const out = [];
  S.words.forEach((o) => { if (o.he && o.lv) out.push(o); });
  return out;
};
let BYLV = null;
function byLevel() {
  if (BYLV && BYLV.size === S.words.size) return BYLV.map;
  const map = new Map();
  words().forEach((o) => {
    if (!map.has(o.lv)) map.set(o.lv, []);
    map.get(o.lv).push(o.w);
  });
  BYLV = { size: S.words.size, map };
  return map;
}
const maxLevel = () => Math.max(1, ...byLevel().keys());
const startLevel = () => pref('lomda.start', 0);      // 0 = לא נעשה מבחן רמה

function status(w) {
  const c = card(w);
  if (c && c.v === 2) return c.s;
  if (c) return migrate(w, c).s;
  const o = S.words.get(w);
  return (o && startLevel() && o.lv < startLevel()) ? 'placed' : 'new';
}

/* כרטיס FSRS ישן → הצורה החדשה. נעשה בעצלות, בפעם הראשונה שנוגעים. */
function migrate(w, c) {
  let n;
  if (c.known) n = { s: 'known', box: 0 };
  else if (c.r > 0) {
    const st = c.st || 0;
    n = { s: 'drill', box: st < 3 ? 1 : st < 7 ? 2 : st < 21 ? 3 : 4 };
  } else n = { s: 'learn', box: 0 };
  const out = Object.assign({ v: 2, streak: 0, sd: 0, hot: 0, r: c.r || 0, l: c.l || 0,
    d: c.d || today(), last: c.last || null, at: Date.now() }, n);
  if (out.s === 'known') delete out.d;
  put('cards', w, out);
  return out;
}
function migrateAll() {
  const cs = ns('cards');
  Object.keys(cs).forEach((w) => { if (cs[w] && cs[w].v !== 2) migrate(w, cs[w]); });
}

function setCard(w, patch) {
  const c = Object.assign({ v: 2, box: 0, streak: 0, sd: 0, hot: 0, r: 0, l: 0 }, card(w) || {}, patch, { at: Date.now() });
  put('cards', w, c);
  return c;
}

/* רמה נוכחית: הנמוכה ביותר מרמת הכניסה ומעלה שעוד יש בה מילים חדשות */
function currentLevel() {
  const m = byLevel(), top = maxLevel();
  for (let lv = Math.max(1, startLevel()); lv <= top; lv++) {
    if ((m.get(lv) || []).some((w) => status(w) === 'new')) return lv;
  }
  return top;
}
function levelStats(lv) {
  const out = { new: 0, known: 0, learn: 0, drill: 0, master: 0, placed: 0, total: 0 };
  (byLevel().get(lv) || []).forEach((w) => { out[status(w)]++; out.total++; });
  return out;
}
const listBy = (s) => words().map((o) => o.w).filter((w) => status(w) === s);

function dueWords() {
  const t = today();
  return listBy('drill').filter((w) => (card(w).d || t) <= t)
    .sort((a, b) => ((card(a).d || '') < (card(b).d || '') ? -1 : 1));
}
const hotWords = () => listBy('drill').filter((w) => (card(w).hot || 0) > 0);

/* ---------- תוצאה של תשובה בתרגול ---------- */
function answer(w, ok) {
  const t = today();
  const c = card(w) && card(w).v === 2 ? card(w) : null;
  const s = status(w);
  if (!ok) {
    /* מילה שחשבנו שידועה ונכשלה — חוזרת ללמידה. מילה בתרגול — לתחילת המסלול. */
    if (s === 'known' || s === 'placed' || s === 'master') {
      setCard(w, { s: 'learn', box: 0, streak: 0, sd: 0, hot: 0, l: ((c && c.l) || 0) + 1, r: ((c && c.r) || 0) + 1, last: t, d: t });
    } else if (s === 'new' || s === 'learn') {
      setCard(w, { s: 'learn', l: ((c && c.l) || 0) + 1, r: ((c && c.r) || 0) + 1, last: t, d: t });
    } else {
      setCard(w, { s: 'drill', box: 0, streak: 0, sd: 0, hot: HOT,
        l: ((c && c.l) || 0) + 1, r: ((c && c.r) || 0) + 1, last: t, d: t });
    }
    return;
  }
  if (s !== 'drill') {                     // בדיקת ידועה/שוחררה שעברה — לא נוגעים
    if (c) setCard(w, { r: (c.r || 0) + 1, last: t });
    return;
  }
  const newDay = c.last !== t;
  const box = Math.min(INTERVALS.length - 1, (c.box || 0) + 1);
  const streak = (c.streak || 0) + 1, sd = (c.sd || 0) + (newDay ? 1 : 0);
  const hot = Math.max(0, (c.hot || 0) - 1);
  let d = addDays(t, INTERVALS[box]);
  const left = between(t, S.exam);
  if (left > 0 && between(t, d) > left) d = S.exam;
  /* שחרור: רצף, על פני יותר מיום אחד — אחרת ארבע נכונות באותו תרגול
     היו משחררות מילה שנלמדה לפני עשר דקות. */
  if (streak >= MASTER_RUN && sd >= 2 && !hot) {
    setCard(w, { s: 'master', box, streak, sd, hot: 0, r: (c.r || 0) + 1, last: t, d: S.exam });
  } else {
    setCard(w, { box, streak, sd, hot, r: (c.r || 0) + 1, last: t, d });
  }
}

/* ============================================================
   שאלה אחת: בחירה מרובה או הקלדה
   ============================================================ */
function distractors(o, n, key) {
  const same = [], near = [], all = words();
  all.forEach((x) => {
    if (x.w === o.w || !x[key] || x[key] === o[key]) return;
    if (key === 'syn' && !(x.syn && x.syn.length)) return;
    if (x.pos === o.pos && Math.abs(x.lv - o.lv) <= 2) same.push(x);
    else if (x.pos === o.pos) near.push(x);
  });
  const pool = shuffle(same).concat(shuffle(near));
  const out = [], seen = new Set([String(o[key])]);
  for (const x of pool) {
    const v = key === 'syn' ? x.syn[0] : x[key];
    if (seen.has(String(v))) continue;
    seen.add(String(v)); out.push(x);
    if (out.length >= n) break;
  }
  return out;
}

const KINDS = {
  enhe: { he: 'אנגלית ← עברית' },
  heen: { he: 'עברית ← אנגלית' },
  def:  { he: 'הגדרה ← מילה' },
  syn:  { he: 'מילה נרדפת' },
  sent: { he: 'השלמת משפט' },
  type: { he: 'הקלדה' },
};

/* בונה את תוכן השאלה. kind שלא אפשרי למילה הזו נופל ל-enhe. */
function question(w, kind) {
  const o = S.words.get(w);
  if (kind === 'syn' && !(o.syn && o.syn.length)) kind = 'enhe';
  if (kind === 'def' && !o.def) kind = 'enhe';
  if (kind === 'sent' && !A.sentOf(w)) kind = 'def';
  if (kind === 'def' && !o.def) kind = 'enhe';
  const q = { w, o, kind };
  if (kind === 'type') {
    q.prompt = '<div class="he hq">' + esc(o.he) + '</div>' +
      '<div class="tiny dim">כתוב באנגלית · ' + o.w.length + ' אותיות · מתחילה ב-<b class="en-in">' + esc(o.w[0]) + '</b></div>';
    return q;
  }
  let key = 'he', optOf = (x) => x.he, rtl = true;
  if (kind === 'enhe') q.prompt = '<div class="head-en">' + esc(o.w) + '</div>';
  if (kind === 'heen') { q.prompt = '<div class="he hq">' + esc(o.he) + '</div>'; key = 'he'; optOf = (x) => x.w; rtl = false; }
  if (kind === 'def')  { q.prompt = '<div class="def">' + esc(o.def) + '</div>'; key = 'def'; optOf = (x) => x.w; rtl = false; }
  if (kind === 'syn')  { q.prompt = '<div class="head-en">' + esc(o.w) + '</div><div class="tiny dim">איזו מהן קרובה במשמעות?</div>';
                         key = 'syn'; optOf = (x) => x.syn[0]; rtl = false; }
  if (kind === 'sent') { q.prompt = '<div class="ex">' + A.blankWord(A.sentOf(w), w) + '</div>'; key = 'he'; optOf = (x) => x.w; rtl = false; }
  const ds = distractors(o, 3, key);
  q.opts = shuffle([o].concat(ds)).map((x) => ({ w: x.w, text: optOf(x), right: x.w === o.w }));
  q.rtl = rtl;
  return q;
}

function norm(s) { return String(s).toLowerCase().replace(/[^a-z\- ]/g, '').trim(); }
function lev(a, b) {
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

/* מצייר שאלה ומחזיר את התוצאה ב-onDone(ok). withIdk מוסיף "לא יודע". */
function ask(q, frame, onDone, opts) {
  opts = opts || {};
  const c = el('div', 'card');
  const mid = el('div', 'mid', (frame.eyebrow ? '<span class="eyebrow">' + esc(frame.eyebrow) + '</span>' : '') + q.prompt);
  const acts = el('div', 'acts');
  let answered = false;

  const after = (ok, chosen) => {
    answered = true;
    buzz(ok ? 10 : 30);
    if (opts.silent) return onDone(ok);          // מבחן רמה: בלי משוב, זורמים
    if (ok) { setTimeout(() => onDone(true), 550); return; }
    const o = q.o;
    const fb = el('div', 'fb');
    fb.innerHTML = '<span class="eyebrow">' + (chosen === null ? 'התשובה' : 'לא בדיוק') + '</span>' +
      '<div class="head-en sm">' + esc(o.w) + '</div>' + A.meaning(o, false);
    mid.appendChild(fb);
    /* האפשרויות נשארות על המסך, מסומנות — לראות מה בחרת מול מה נכון
       הוא חצי מהלימוד. רק "לא יודע" יורד. */
    acts.querySelectorAll('.btn').forEach((b) => b.remove());
    const go = el('button', 'btn', 'המשך');
    go.onclick = () => onDone(false);
    acts.appendChild(go);
    setTimeout(() => go.focus(), 30);
  };

  if (q.kind === 'type') {
    const inp = el('input', 't en-input');
    inp.type = 'text'; inp.autocomplete = 'off'; inp.autocapitalize = 'off'; inp.spellcheck = false;
    inp.setAttribute('aria-label', 'המילה באנגלית');
    const check = el('button', 'btn', 'בדוק');
    const idk = el('button', 'btn ghost sm', 'לא יודע');
    const submit = () => {
      if (answered) return;
      const v = norm(inp.value), target = norm(q.o.w);
      if (!v) { inp.focus(); return; }
      const ok = v === target || (target.length >= 6 && lev(v, target) === 1);
      inp.disabled = true;
      inp.classList.add(ok ? 'right' : 'wrong');
      if (ok && v !== target) toast('כמעט — ' + q.o.w);
      after(ok, v);
    };
    check.onclick = submit;
    inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } };
    idk.onclick = () => { if (!answered) { inp.disabled = true; after(false, null); } };
    acts.append(inp, check, idk);
    setTimeout(() => inp.focus(), 60);
  } else {
    q.opts.forEach((op, i) => {
      const b = el('button', 'opt' + (q.rtl ? ' he-opt' : ''), '<span class="num">' + (i + 1) + '</span>' + esc(op.text));
      b.onclick = () => {
        if (answered) return;
        acts.querySelectorAll('.opt').forEach((x, k) => {
          x.disabled = true;
          if (!opts.silent && q.opts[k].right) x.classList.add('right');
        });
        if (opts.silent) b.classList.add('pick');
        else if (!op.right) b.classList.add('wrong');
        after(op.right, op.w);
      };
      acts.appendChild(b);
    });
    if (opts.idk) {
      const idk = el('button', 'btn ghost sm', 'לא יודע');
      idk.onclick = () => {
        if (answered) return;
        acts.querySelectorAll('.opt').forEach((x, k) => { x.disabled = true; if (!opts.silent && q.opts[k].right) x.classList.add('right'); });
        after(false, null);
      };
      acts.appendChild(idk);
    }
  }
  c.append(mid, acts);
  const box = openStudy(c, frame);
  box.className = 'study m-' + (frame.mode || 'exam');
  return box;
}

/* ============================================================
   מבחן רמה
   ============================================================
   רמה אחרי רמה: עוברים ב-90% ממשיכים, נכשלים עוצרים. כדי לא לבחון
   משתמש חזק על עשר רמות, כל עוד הוא עובר מדלגים שתי רמות — ורק כשהוא
   נכשל חוזרים לבחון את הרמה שדילגנו עליה. */
let PT = null;

function startPlacement() {
  const top = maxLevel();
  PT = { lv: 1, passed: 0, failed: top + 1, step: 2, items: [], i: 0, ok: 0, total: 0, missed: [] };
  intro();
  function intro() {
    const c = el('div', 'card');
    c.innerHTML = '<div class="mid"><span class="eyebrow">מבחן רמה</span>' +
      '<h2 class="obt">מאיפה מתחילים</h2>' +
      '<p class="note" style="text-align:center;max-width:42ch">המבחן בודק כמה מילים מכל רמה ומוצא את הרמה ' +
      'הראשונה שבה כבר לא הכול מוכר לך. כדי לדלג על רמה צריך <b>90%</b> — טעות אחת או שתיים ' +
      'אומרות שעדיין שווה ללמוד אותה.</p>' +
      '<p class="note" style="text-align:center;max-width:42ch">אין משוב תוך כדי. לא בטוח? "לא יודע" עדיף על ניחוש.</p></div>';
    const a = el('div', 'acts');
    const go = el('button', 'btn', 'מתחילים');
    go.onclick = () => testLevel(PT.lv);
    a.appendChild(go); c.appendChild(a);
    openStudy(c, { i: 0, n: 1, right: '', close: () => { PT = null; A.render(); } }).className = 'study m-elim';
  }
}

function testLevel(lv) {
  const pool = shuffle((byLevel().get(lv) || []).slice()).slice(0, TEST_N);
  if (!pool.length) return placementDone();
  PT.lv = lv; PT.items = pool; PT.i = 0; PT.ok = 0;
  stepTest();
}
function stepTest() {
  if (PT.i >= PT.items.length) return judgeLevel();
  const w = PT.items[PT.i];
  const q = question(w, 'enhe');
  ask(q, { i: PT.total, n: PT.total + PT.items.length - PT.i + 10, right: 'רמה ' + PT.lv,
           eyebrow: 'מבחן רמה · רמה ' + PT.lv + ' · ' + (PT.i + 1) + '/' + PT.items.length,
           mode: 'elim', close: () => { PT = null; A.render(); } },
      (ok) => {
        if (ok) PT.ok++;
        else PT.missed.push(w);
        PT.i++; PT.total++;
        stepTest();
      }, { silent: true, idk: true });
}

function judgeLevel() {
  const pass = PT.ok / PT.items.length >= TEST_PASS;
  if (pass) {
    PT.passed = Math.max(PT.passed, PT.lv);
    const nx = PT.lv + PT.step;
    if (nx >= PT.failed) {
      if (PT.lv + 1 >= PT.failed) return placementDone();
      PT.step = 1; return pause(PT.lv + 1);
    }
    return pause(Math.min(nx, maxLevel() + 1));
  }
  PT.failed = Math.min(PT.failed, PT.lv);
  PT.step = 1;
  if (PT.passed + 1 < PT.failed) return pause(PT.passed + 1);
  placementDone();
}
/* "מדי פעם הוא עוצר לחשוב" — רגע של חישוב בין רמות, שנראה כמו מה שהוא */
function pause(lv) {
  if (lv > maxLevel()) return placementDone();
  const c = el('div', 'card');
  c.innerHTML = '<div class="mid"><div class="spin" aria-hidden="true"></div><div class="tiny dim">מחשב את הרמה הבאה…</div></div>';
  openStudy(c, { i: PT.total, n: PT.total + 10, right: '', close: () => { PT = null; A.render(); } }).className = 'study m-elim';
  setTimeout(() => { if (PT) testLevel(lv); }, 700);
}
function placementDone() {
  const start = Math.min(maxLevel(), PT.passed + 1);
  setPref('lomda.start', start);
  /* מילה שנכשלה במבחן, עד רמת הכניסה — כבר ידוע שהיא לא יושבת, אז היא
     הולכת ישר לשינון ולא נשאלת שוב בסינון. מילים מרמות גבוהות יותר
     נשארות חדשות: אחרת תור השינון היה מתמלא ברמה 10 כשלומדים רמה 4. */
  PT.missed.forEach((w) => { const o = S.words.get(w); if (o && o.lv <= start) setCard(w, { s: 'learn', d: today() }); });
  const below = start - 1;
  const c = el('div', 'card');
  c.innerHTML = '<div class="mid"><span class="eyebrow">נקודת ההתחלה שלך</span>' +
    '<div class="head-en">רמה ' + start + '</div>' +
    '<p class="note" style="text-align:center;max-width:42ch">' +
    (below ? 'רמות 1–' + below + ' ידועות לך ברמה של 90% ומעלה, ולכן לא תלמד אותן מחדש. ' +
      'מילים מהן עדיין יופיעו בתרגולים — כדי לוודא.'
      : 'מתחילים מההתחלה. זה בסדר גמור: ברמות הראשונות רוב המילים יהיו מוכרות ותתקדם מהר.') +
    '</p><p class="note" style="text-align:center;max-width:42ch">מכאן — פשוט "המשך". הלומדה תחליט מה לעשות בכל פעם.</p></div>';
  const a = el('div', 'acts');
  const go = el('button', 'btn', 'מתחילים ללמוד');
  go.onclick = () => { PT = null; next(); };
  a.appendChild(go); c.appendChild(a);
  openStudy(c, { i: 1, n: 1, right: '', close: () => { PT = null; A.render(); } }).className = 'study m-elim';
}

/* ============================================================
   סבב — ההחלטה
   ============================================================ */
function decide() {
  if (!startLevel()) return 'placement';
  const learn = listBy('learn').length;
  const drill = listBy('drill').length;
  const since = pref('lomda.since', 0);
  const hasNew = levelStats(currentLevel()).new > 0;
  if (learn >= RED_BATCH) return 'memorize';
  /* מילה שנשכחה או חוב חזרות מקדימים את התרגול — אבל לא מיד אחרי תרגול,
     אחרת מילה חמה אחת הייתה נועלת את הלומד בלולאת תרגולים. */
  if (drill && (since >= 2 || (since >= 1 && (hotWords().length || dueWords().length >= 15)))) return 'practice';
  if (hasNew) return 'filter';
  if (learn) return 'memorize';
  if (drill || listBy('known').length) return 'practice';
  return 'done';
}
function next() {
  const d = decide();
  if (d === 'placement') return startPlacement();
  if (d === 'memorize') return startMemorize();
  if (d === 'practice') return practiceMenu();
  if (d === 'filter') return startFilter();
  toast('סיימת את כל המאגר. מרשים.');
  closeStudy(); A.render();
}
function roundDone(kind) {
  bump({ rounds: 1 });
  setPref('lomda.since', kind === 'practice' ? 0 : pref('lomda.since', 0) + 1);
}

/* ============================================================
   סינון
   ============================================================ */
let FL = null;
function startFilter() {
  const lv = currentLevel();
  const q = shuffle((byLevel().get(lv) || []).filter((w) => status(w) === 'new')).slice(0, FILTER_MAX);
  if (!q.length) return next();
  FL = { lv, q, i: 0, red: listBy('learn').length, green: 0, shown: 0 };
  paintFilter();
}
function paintFilter() {
  if (FL.red >= RED_BATCH || FL.i >= FL.q.length) {
    const red = FL.red;
    roundDone('filter');
    FL = null;
    if (red) return interlude('מספיק מילים אדומות', A.plural(red, 'מילה אחת', 'מילים') + ' שלא ידעת. עוברים לשנן אותן.', startMemorize);
    return next();
  }
  const w = FL.q[FL.i], o = S.words.get(w);
  const c = el('div', 'card');
  const mid = el('div', 'mid',
    '<span class="eyebrow">סינון · רמה ' + FL.lv + '</span>' +
    '<div class="head-en">' + esc(o.w) + '</div>' +
    (o.pos ? '<div class="pos">' + esc(o.pos) + '</div>' : '') +
    '<div class="tiny dim">יודע מה זה אומר, בלי להסס?</div>');
  const acts = el('div', 'acts');
  const g = el('div', 'grades'); g.style.gridTemplateColumns = 'repeat(2,1fr)';
  const mark = (known) => {
    if (known) { setCard(w, { s: 'known', last: today() }); FL.green++; }
    else { setCard(w, { s: 'learn', d: today() }); FL.red++; }
    FL.i++; paintFilter();
  };
  const no = el('button', 'grade g1', 'לא יודע');
  const yes = el('button', 'grade g3', 'יודע');
  no.onclick = () => mark(false); yes.onclick = () => mark(true);
  g.append(no, yes);
  const peek = el('button', 'btn ghost sm', 'הצץ בתרגום');
  peek.onclick = () => { peek.remove(); mid.appendChild(el('div', 'he', esc(o.he))); };
  acts.append(g, peek);
  c.append(mid, acts);
  openStudy(c, { i: FL.red, n: RED_BATCH, right: FL.red + '/' + RED_BATCH + ' אדומות',
                 close: () => { FL = null; A.render(); } }).className = 'study m-frame';
}

function interlude(head, body, fn) {
  const c = el('div', 'card');
  c.innerHTML = '<div class="mid"><span class="eyebrow">' + esc(head) + '</span><p class="note" style="text-align:center;max-width:40ch">' + body + '</p></div>';
  const a = el('div', 'acts');
  const go = el('button', 'btn', 'המשך');
  go.onclick = fn;
  const stop = el('button', 'btn ghost sm', 'מספיק לעכשיו');
  stop.onclick = () => { closeStudy(); A.render(); };
  a.append(go, stop); c.appendChild(a);
  openStudy(c, { i: 1, n: 1, right: '', close: () => A.render() });
  setTimeout(() => go.focus(), 30);
}

/* ============================================================
   שינון + מבדק
   ============================================================ */
let MZ = null;
function startMemorize(only) {
  const list = only || listBy('learn').slice(0, RED_BATCH + 4);
  if (!list.length) return next();
  MZ = { list, i: 0, round: (MZ && only) ? MZ.round + 1 : 1 };
  paintMem();
}
function paintMem() {
  const w = MZ.list[MZ.i], o = S.words.get(w);
  const c = el('div', 'card');
  const mid = el('div', 'mid');
  mid.style.justifyContent = 'flex-start';
  mid.innerHTML = '<span class="eyebrow">שינון' + (MZ.round > 1 ? ' · סיבוב ' + MZ.round : '') + ' · ' + (MZ.i + 1) + '/' + MZ.list.length + '</span>' +
    '<div class="head-en">' + esc(o.w) + '</div>' + A.meaning(o, true);
  const as = el('div', 'acts mem-assoc');
  as.innerHTML = '<label class="f" for="mz-a">אסוציאציה — צליל, תמונה, משפט משלך. כל מה שיעזור לזכור.</label>' +
    '<textarea class="t" id="mz-a" rows="2" placeholder="למשל: scarce → &quot;סקרס&quot; — מצרך נדיר שנגמר מהמדף"></textarea>';
  mid.appendChild(as);
  const acts = el('div', 'acts');
  const nav = el('div', 'grades'); nav.style.gridTemplateColumns = 'repeat(2,1fr)';
  const save = () => {
    const t = document.querySelector('#mz-a');
    const v = t && t.value.trim();
    if (v && v !== assoc(w)) put('assoc', w, { text: v, at: Date.now() });
  };
  const back = el('button', 'grade', 'הקודמת');
  back.disabled = MZ.i === 0;
  back.onclick = () => { save(); MZ.i--; paintMem(); };
  const fwd = el('button', 'grade g3', MZ.i === MZ.list.length - 1 ? 'למבדק' : 'הבאה');
  fwd.onclick = () => { save(); if (MZ.i < MZ.list.length - 1) { MZ.i++; paintMem(); } else startCheck(); };
  nav.append(back, fwd);
  acts.appendChild(nav);
  c.append(mid, acts);
  openStudy(c, { i: MZ.i, n: MZ.list.length, close: () => { MZ = null; A.render(); } }).className = 'study m-read';
  const t = document.querySelector('#mz-a');
  if (t) t.value = assoc(w);
}

function startCheck() {
  const items = shuffle(MZ.list.slice());
  const miss = [];
  let i = 0;
  const step = () => {
    if (i >= items.length) return checkDone(miss);
    const w = items[i];
    const q = question(w, i % 2 ? 'heen' : 'enhe');
    ask(q, { i, n: items.length, right: 'מבדק', eyebrow: 'מבדק · ' + (i + 1) + '/' + items.length, mode: 'read',
             close: () => { MZ = null; A.render(); } },
      (ok) => {
        if (ok) setCard(w, { s: 'drill', box: 1, streak: 0, sd: 0, hot: 0, last: today(), d: addDays(today(), 1) });
        else { miss.push(w); const c = card(w) || {}; setCard(w, { s: 'learn', l: (c.l || 0) + 1 }); }
        bump({ rev: 1, ok: ok ? 1 : 0 });
        i++; step();
      });
  };
  step();
}
function checkDone(miss) {
  const n = MZ.list.length;
  if (miss.length) {
    return interlude('עוד סיבוב',
      (n - miss.length) + ' מתוך ' + n + ' נכנסו. ' + A.plural(miss.length, 'מילה אחת עוד לא', 'מילים עוד לא') +
      ' — סיבוב שינון קצר רק עליהן, ומבדק שוב.',
      () => startMemorize(miss));
  }
  bump({ new: n });
  roundDone('memorize');
  MZ = null;
  const c = el('div', 'card');
  c.innerHTML = '<div class="mid"><span class="eyebrow">נכנס</span><div class="head-en">' + n + '</div>' +
    '<div class="he">מילים עברו לתרגול</div><div class="tiny dim">הן יחזרו בתרגולים הבאים עד שהלומדה תשתכנע.</div></div>';
  const a = el('div', 'acts');
  const go = el('button', 'btn', 'סבב נוסף');
  go.onclick = next;
  const stop = el('button', 'btn ghost sm', 'מספיק לעכשיו');
  stop.onclick = () => { closeStudy(); A.render(); };
  a.append(go, stop); c.appendChild(a);
  openStudy(c, { i: 1, n: 1, right: '', close: () => A.render() });
}

/* ============================================================
   תרגול
   ============================================================ */
function pickPractice() {
  const out = [], seen = new Set();
  const add = (w) => { if (w && !seen.has(w) && out.length < PRACTICE_N) { seen.add(w); out.push(w); } };
  hotWords().forEach(add);
  dueWords().forEach(add);
  /* שיננו לאחרונה — גם אם לא בפירעון, חיזוק מוקדם */
  listBy('drill').sort((a, b) => (card(b).at || 0) - (card(a).at || 0)).slice(0, 6).forEach(add);
  /* ~15% בדיקה של "ידועות", מרמות הכניסה ומתחתיהן */
  const checks = Math.max(2, Math.round(PRACTICE_N * 0.15));
  const lower = [];
  const sl = startLevel();
  byLevel().forEach((ws, lv) => { if (lv < sl + 1) ws.forEach((w) => { const s = status(w); if (s === 'placed' || s === 'known') lower.push(w); }); });
  const known = listBy('known');
  shuffle(lower.concat(known)).slice(0, checks).forEach((w) => { if (out.length < PRACTICE_N) { seen.add(w); out.push(w); } });
  listBy('drill').forEach(add);
  listBy('master').filter(() => Math.random() < 0.1).forEach(add);
  return shuffle(out);
}

function practiceMenu() {
  const last = pref('lomda.kind', '');
  const order = Object.keys(KINDS);
  const suggested = order[(order.indexOf(last) + 1) % order.length];
  const c = el('div', 'card');
  const mid = el('div', 'mid',
    '<span class="eyebrow">תרגול</span><h2 class="obt">איזה סוג הפעם?</h2>' +
    '<p class="note" style="text-align:center;max-width:40ch">הלומדה בוחרת את המילים: מה שנשכח, מה שבפירעון, ' +
    'מה ששיננת לאחרונה, וקצת בדיקה של מה שנחשב ידוע. בפעמים הראשונות — נסה כל פעם סוג אחר.</p>');
  const acts = el('div', 'acts');
  const grid = el('div', 'kinds');
  order.forEach((k) => {
    const b = el('button', 'kind' + (k === suggested ? ' on' : ''), esc(KINDS[k].he) + (k === suggested ? '<small>מומלץ עכשיו</small>' : ''));
    b.onclick = () => startPractice(k);
    grid.appendChild(b);
  });
  acts.appendChild(grid);
  c.append(mid, acts);
  openStudy(c, { i: 0, n: 1, right: '', close: () => A.render() }).className = 'study m-exam';
}

let PR = null;
function startPractice(kind) {
  const list = pickPractice();
  if (!list.length) { toast('אין עוד מילים לתרגל — קודם סינון ושינון'); return startFilter(); }
  setPref('lomda.kind', kind);
  PR = { kind, list, i: 0, ok: 0, mastered: [], missed: [] };
  stepPractice();
}
function stepPractice() {
  if (PR.i >= PR.list.length) return practiceDone();
  const w = PR.list[PR.i];
  const q = question(w, PR.kind);
  ask(q, { i: PR.i, n: PR.list.length, right: PR.ok + ' ✓', eyebrow: KINDS[PR.kind].he, mode: 'exam',
           close: () => { if (PR.i) roundDone('practice'); PR = null; A.render(); } },
    (ok) => {
      const before = status(w);
      answer(w, ok);
      if (ok) PR.ok++; else PR.missed.push(w);
      if (before !== 'master' && status(w) === 'master') PR.mastered.push(w);
      bump({ rev: 1, ok: ok ? 1 : 0 });
      PR.i++; stepPractice();
    });
}
function practiceDone() {
  roundDone('practice');
  const P = PR; PR = null;
  const c = el('div', 'card');
  let h = '<div class="mid"><span class="eyebrow">תרגול · ' + esc(KINDS[P.kind].he) + '</span>' +
    '<div class="head-en">' + P.ok + '/' + P.list.length + '</div>';
  if (P.mastered.length) h += '<div class="note">שוחררו: <b class="en-in">' + P.mastered.map(esc).join(', ') + '</b> — נזכרת ברצף, מפנים מקום לחדשות.</div>';
  if (P.missed.length) h += '<div class="note">יחזרו בתרגולים הקרובים: <b class="en-in">' + P.missed.map(esc).join(', ') + '</b></div>';
  h += '</div>';
  c.innerHTML = h;
  const a = el('div', 'acts');
  const go = el('button', 'btn', 'סבב נוסף');
  go.onclick = next;
  const stop = el('button', 'btn ghost sm', 'מספיק לעכשיו');
  stop.onclick = () => { closeStudy(); A.render(); };
  a.append(go, stop); c.appendChild(a);
  openStudy(c, { i: 1, n: 1, right: '', close: () => A.render() });
}

/* ============================================================
   כרטיס במסך הבית
   ============================================================ */
function homeCard(v) {
  const sec = el('div', 'sec lcard');
  const rounds = A.day().rounds || 0;
  const dots = '<span class="rdots" aria-label="' + Math.min(rounds, ROUNDS_GOAL) + ' מתוך ' + ROUNDS_GOAL + ' סבבים היום">' +
    Array.from({ length: ROUNDS_GOAL }, (_, i) => '<i class="' + (i < rounds ? 'on' : '') + '"></i>').join('') + '</span>';
  let go;
  if (!startLevel()) {
    sec.innerHTML = '<div class="lc-top"><span class="lc-k">לומדת המילים</span></div>' +
      '<div class="lc-t">מתחילים במבחן רמה</div>' +
      '<p class="lc-s">כמה דקות. המבחן מוצא את הרמה הראשונה שבה כבר לא הכול מוכר לך, ומשם הלומדה מובילה.</p>';
    go = el('button', 'btn', 'למבחן הרמה');
  } else {
    const lv = currentLevel(), st = levelStats(lv);
    const done = st.total - st.new;
    const d = decide();
    const what = { memorize: 'שינון', practice: 'תרגול', filter: 'סינון', done: 'הכול נלמד' }[d] || '';
    const why = { memorize: 'מילים שסימנת שלא ידעת מחכות', practice: 'לחזק את מה שכבר שיננת',
                  filter: 'למיין מילים חדשות מרמה ' + lv, done: '' }[d] || '';
    const hot = hotWords().length;
    sec.innerHTML = '<div class="lc-top"><span class="lc-k">לומדת המילים · רמה ' + lv + ' מתוך ' + maxLevel() + '</span>' + dots + '</div>' +
      '<div class="lc-t">הסבב הבא: ' + what + '</div>' +
      '<p class="lc-s">' + why + '</p>' +
      '<div class="bar lc-bar"><i style="width:' + (st.total ? done / st.total * 100 : 0) + '%;background:var(--accent)"></i></div>' +
      '<div class="lc-meta"><span>' + done + '/' + st.total + ' ברמה</span>' +
      '<span>' + listBy('drill').length + ' בתרגול</span>' +
      (hot ? '<span class="hot">' + A.plural(hot, 'אחת נשכחה', 'נשכחו') + '</span>' : '') +
      '<span>' + listBy('master').length + ' שוחררו</span></div>';
    go = el('button', 'btn', rounds >= ROUNDS_GOAL ? 'עוד סבב' : 'המשך');
  }
  go.onclick = next;
  sec.appendChild(go);
  v.appendChild(sec);
}

/* ---------- מסך הלומדה ----------
   הכרטיס, מפת הרמות, והמילון — הכול במקום אחד. */
function hub(v) {
  A.head(v, 'לומדה', 'מנות קטנות לאורך היום. כ‑4 סבבים ביום, והלומדה מחליטה מה לעשות.');
  homeCard(v);
  if (startLevel()) {
    const sec = el('div', 'sec');
    const top = maxLevel(), cur = currentLevel();
    sec.appendChild(el('span', 'eyebrow', 'הרמות'));
    const grid = el('div', 'lvgrid');
    for (let lv = 1; lv <= top; lv++) {
      const st = levelStats(lv);
      const pct = st.total ? Math.round((st.total - st.new) / st.total * 100) : 0;
      grid.appendChild(el('div', 'lv' + (lv === cur ? ' cur' : '') + (pct === 100 ? ' full' : ''),
        '<i style="height:' + pct + '%"></i><b>' + lv + '</b>'));
    }
    sec.appendChild(grid);
    sec.appendChild(el('p', 'note', 'רמה נמוכה = מילה נפוצה = משפיעה יותר על הציון. זה בסדר לא להגיע לרמות הגבוהות.'));
    v.appendChild(sec);
  }
  if (window.AMWords) window.AMWords.view(v);
}

/* ============================================================
   תאימות לשאר האפליקציה
   ============================================================ */
const bucket = (c) => {
  if (!c) return 'new';
  const s = c.v === 2 ? c.s : (c.known ? 'known' : 'drill');
  if (s === 'learn' || (s === 'drill' && (c.box || 0) <= 1)) return 'young';
  if (s === 'drill') return 'solid';
  return 'strong';
};
function markKnown(w) { setCard(w, { s: 'known', last: today() }); }
function newList() {
  const lv = currentLevel();
  return (byLevel().get(lv) || []).filter((w) => status(w) === 'new');
}

const STATUS_HE = { new: 'חדשה', known: 'ידועה', learn: 'לשינון', drill: 'בתרגול', master: 'שוחררה', placed: 'מתחת לרמת הכניסה' };

document.addEventListener('am:ready', migrateAll);
document.addEventListener('cloud:merged', () => { BYLV = null; migrateAll(); });
if (S.ready) migrateAll();

window.AMLomda = {
  next, homeCard, hub, startPlacement, status, currentLevel, levelStats, maxLevel, startLevel,
  answer, bucket, markKnown, newList, dueWords, hotWords, listBy, STATUS_HE, byLevel,
  _decide: decide,
};

})();
