/* ================= אמירנט — תרגול בפורמט המבחן =================

   ארבעה דרילים, אחד לכל מקור נקודות לפי משקלו: השלמת משפטים 12/19,
   ניסוח מחדש 6/19, הבנת הנקרא 5/19. וכן שלושה משחקים, הדפסה לשבת
   ומסך התקדמות.

   כל פריט כאן הוא שאלה אמיתית ממבחן עבר עם התשובה הרשמית. הפריטים
   מגיעים מהמסד ולא מהקוד — ראה README.
   ============================================================== */
'use strict';

(function () {

const A = window.AM;
const { el, esc, shuffle, toast, openStudy, closeStudy, today, addDays, between,
        heDate, ns, put, pref, setPref, bump, day, streak, card, S } = A;


/* ---------- משטח עם זהות צבע ---------- */
function openMode(cardEl, opts, mode) {
  const box = openStudy(cardEl, opts);
  box.className = 'study m-' + mode;
  return box;
}

/* ============================================================
   ההסבר
   ============================================================
   בלי זה התרגול הוא בדיקה ולא לימוד. אין כאן הסבר שנכתב ביד לכל אחד
   מ-1,273 הפריטים; יש הסבר שנבנה מהנתונים שכבר קיימים, ולכן הוא מכסה
   את כולם: המשפט השלם עם התשובה במקומה, ארבע האפשרויות עם המשמעות של
   כל אחת, והמסגרת הלוגית כשהיא נוכחת. */

function glossRow(word, mark, cls) {
  const o = S.words.get(String(word).toLowerCase().trim());
  const gl = o && (o.def || o.he)
    ? '<div class="gl">' + (o.def ? esc(o.def) : '') +
      (o.he ? ' — <b>' + esc(o.he) + '</b>' : '') + '</div>'
    : '<div class="gl dim">—</div>';
  return '<div class="opt-row ' + cls + '">' +
    '<div class="mk">' + mark + '</div>' +
    '<div><div class="en">' + esc(word) + '</div>' + gl + '</div></div>';
}

function whySC(it, chosen) {
  const box = el('div', 'why');
  let h = '';
  if (it.full) {
    h += '<h4>המשפט השלם</h4><div class="ex">' +
      A.highlightWord(it.full, it.options[it.answer]) + '</div>';
  }
  const f = frameOf(it.stem);
  if (f) {
    h += '<div class="note">' + (f === 'definition'
      ? '<b>המשפט מגדיר את עצמו.</b> הפסוקית או האפוזיציה אומרות מה המילה החסרה — ' +
        'זו אחת משתי המסגרות היחידות שמכריעות את השאלה כשהן נוכחות.'
      : '<b>יש כאן היפוך.</b> המילה החסרה חייבת להיות בקוטביות ההפוכה מהחצי השני של המשפט.') +
      '</div>';
  }
  h += '<h4>ארבע האפשרויות</h4>';
  it.options.forEach((o, k) => {
    h += glossRow(o, k === it.answer ? '✓' : (k === chosen ? '✗' : (k + 1)),
      k === it.answer ? 'ok' : k === chosen ? 'no' : 'dim');
  });
  box.innerHTML = h;
  return box;
}

/* ההבדל בין המקור למסיח, מסומן מילה-מילה. במקום לכתוב 232 הסברים ביד,
   מראים בדיוק מה המסיח הוסיף שלא היה במקור — וזו בפועל המלכודת השכיחה
   ביותר בפרק הזה (עובדה שלא נאמרה, 29%). */
const STOPW = new Set(('a an the of in on at to for and or but is are was were be been by with '
  + 'that this these those it its as from has have had not no than then so such which who whose '
  + 'their his her they he she we you i there').split(' '));
const stemOf = (w) => w.toLowerCase().replace(/[^a-z]/g, '').replace(/(ing|ed|es|s|ly)$/, '');

function diffAgainst(src, txt) {
  const base = new Set(src.split(/\s+/).map(stemOf).filter(Boolean));
  return txt.split(/(\s+)/).map((tok) => {
    if (!tok.trim()) return tok;
    const k = stemOf(tok);
    if (!k || k.length < 3 || STOPW.has(tok.toLowerCase().replace(/[^a-z]/g, ''))) return esc(tok);
    return base.has(k) ? esc(tok) : '<ins>' + esc(tok) + '</ins>';
  }).join('');
}

function whyRS(it, chosen) {
  const box = el('div', 'why');
  let h = '<h4>מה השתנה מול המקור</h4>' +
    '<div class="note">מסומן מה שהמסיח <b>הוסיף</b> ולא היה במשפט המקורי. ' +
    'המלכודת השכיחה בפרק הזה היא בדיוק זו — עובדה שלא נאמרה, 29% מהמסיחים.</div>';
  it.options.forEach((o, k) => {
    const mark = k === it.answer ? '✓' : (k === chosen ? '✗' : (k + 1));
    const cls = k === it.answer ? 'ok' : k === chosen ? 'no' : 'dim';
    h += '<div class="opt-row ' + cls + '"><div class="mk">' + mark + '</div>' +
      '<div class="en diff" style="font-size:var(--fs-base)">' + diffAgainst(it.stem, o) + '</div></div>';
  });
  const lens = it.options.map((x) => x.split(/\s+/).length);
  const shortest = lens.indexOf(Math.min(...lens));
  h += '<div class="note">' + (shortest === it.answer
    ? 'כאן דווקא הקצרה הייתה נכונה — זה קורה ב‑14% מהפריטים.'
    : '<b>הקצרה ביותר</b> הייתה אפשרות ' + (shortest + 1) + ', והיא לא הנכונה. ' +
      'זה נכון ב‑86% מהמקרים — היוריסטיקת החיסול היחידה שעמדה במבחן סטטיסטי.') + '</div>';
  box.innerHTML = h;
  return box;
}

/* ---------- תיוג פריטים ----------
   נגזר מהטקסט ולא נשמר, כדי שלא יהיה מקור אמת שני שיכול להתיישן. */

const FRAME_DEF  = /(,\s*(?:an?|the)\s[^,]{3,70},)|(\bknown as\b)|(\bcalled\b)|(:\s)/i;
const FRAME_CONT = /\bbut\b|\balthough\b|\bthough\b|;|\byet\b|\bdespite\b|\bin contrast\b|\bwhereas\b|\bonce\b/i;
const frameOf = (stem) => FRAME_CONT.test(stem) ? 'contrast' : FRAME_DEF.test(stem) ? 'definition' : null;

const RC_TYPES = [
  ['purpose_para', /main purpose of the (\w+) paragraph/i, 'מטרת הפסקה'],
  ['purpose_text', /main purpose of (?:this |the )?text/i,  'מטרת הטקסט'],
  ['title',        /appropriate title|good title/i,          'כותרת מתאימה'],
  ['vocab',        /closest in meaning|best be replaced|means something different/i, 'מילה בהקשר'],
  ['reference',    /refers to/i,                             'למה מתייחס'],
  ['except',       /except|is not made|not answered|not mentioned/i, 'שאלת EXCEPT'],
  ['inference',    /can be inferred|can be understood/i,     'הסקה'],
  ['detail',       /according to/i,                          'איתור פרט'],
];
function rcType(stem) {
  for (const [k, re, he] of RC_TYPES) if (re.test(stem)) return { k, he };
  return { k: 'other', he: 'אחר' };
}

/* מתכון התקפה לכל תבנית — נלמד פעם אחת ואז נבדק. */
const RECIPE = {
  purpose_para: 'קרא רק את משפט הפתיחה של אותה פסקה. ב־20% מכל שאלות הבנת הנקרא זו התבנית, והתשובה כמעט תמיד שם.',
  purpose_text: 'שאלה גלובלית. חפש את מה שנכון לכל הפסקאות, לא רק לאחת.',
  title:        'כותרת חייבת לכסות את כל הטקסט. פסול כל אפשרות שמתארת פסקה אחת בלבד.',
  vocab:        'אל תתרגם — הצב כל אפשרות בחזרה במשפט ובדוק מה מתאים להקשר.',
  reference:    'חזור שורה־שתיים אחורה. הכינוי כמעט תמיד מצביע על שם העצם האחרון שמתאים במספר.',
  except:       'שלוש מהאפשרויות נמצאות בטקסט. סמן אותן ומה שנשאר הוא התשובה.',
  inference:    'התשובה לא כתובה במפורש אבל חייבת לנבוע. אם צריך להוסיף הנחה — זו לא היא.',
  detail:       'איתור טהור. חזור לפסקה שצוינה וחפש; אל תסמוך על הזיכרון מהקריאה.',
  other:        'קרא את השאלה עד הסוף לפני שאתה מסתכל באפשרויות.',
};

/* ---------- ציון ---------- */
let SCALE = null;
async function scale() {
  if (!SCALE) { try { SCALE = (await fetch('data/scale.json').then((r) => r.json())).scale; } catch (e) { SCALE = null; } }
  return SCALE;
}
/* ציון גלם על 44 → סולם 50–150, לפי טבלת המעבר הרשמית. */
function toScale(correct, total) {
  if (!SCALE || !total) return null;
  const raw = Math.round(correct / total * 44);
  return SCALE[Math.max(0, Math.min(44, raw))];
}

/* ---------- מעקב ניסיונות ---------- */
function logAttempt(id, chosen, right, ms, pass) {
  put('attempt', id, { c: chosen, ok: right ? 1 : 0, ms, pass, at: Date.now() });
  bump({ ex: 1, exok: right ? 1 : 0 });
}
const attempts = () => ns('attempt');

/* ============================================================
   דריל א' — פרק אמיתי של השלמת משפטים
   4 פריטים, 4:00, ניווט חופשי. זה בדיוק הפרק במבחן.
   ============================================================ */
let RUN = null;

async function startSection(kind, count, seconds, title) {
  const rows = await A.bank(kind);
  if (!rows || !rows.length) { toast('בנק השאלות לא נטען — התחבר קודם'); return; }
  const done = attempts();
  const fresh = rows.filter((r) => !done[itemId(r)]);
  const pool = fresh.length >= count ? fresh : rows;
  RUN = {
    items: shuffle(pool.slice()).slice(0, count),
    i: 0, answers: {}, firstPass: {}, seconds, left: seconds,
    title, t0: Date.now(), ended: false,
  };
  tick();
  paintSection();
}
const itemId = (r) => r.kind + ':' + r.exam + ':' + r.sec + ':' + r.n;

function tick() {
  clearInterval(RUN._t);
  RUN._t = setInterval(() => {
    if (!RUN || RUN.ended) return clearInterval(RUN._t);
    RUN.left--;
    const c = document.querySelector('#clock');
    if (c) {
      c.textContent = fmt(RUN.left);
      c.className = 'clock' + (RUN.left <= 30 ? ' low' : '');
    }
    if (RUN.left <= 0) { clearInterval(RUN._t); endSection(); }
  }, 1000);
}
const fmt = (s) => Math.floor(Math.max(0, s) / 60) + ':' + String(Math.max(0, s) % 60).padStart(2, '0');

function paintSection() {
  const it = RUN.items[RUN.i], id = itemId(it);
  const c = el('div', 'card');
  const mid = el('div', 'mid');
  mid.innerHTML = '<span class="eyebrow">' + esc(RUN.title) + ' · שאלה ' + (RUN.i + 1) + ' מתוך ' + RUN.items.length + '</span>' +
    '<div class="ex" style="font-size:var(--fs-lg)">' + A.examSentence(it.stem) + '</div>';
  const box = el('div', 'opts');
  it.options.forEach((o, k) => {
    const b = el('button', 'opt' + (RUN.answers[id] === k ? ' pick' : ''),
      '<span class="num">(' + (k + 1) + ')</span>' + esc(o));
    b.onclick = () => {
      if (!(id in RUN.firstPass)) RUN.firstPass[id] = k;   // מה ענית במעבר הראשון
      RUN.answers[id] = k;
      paintSection();
    };
    box.appendChild(b);
  });
  mid.appendChild(box);

  /* ניווט חופשי בין ארבע השאלות — בדיוק מה שהמבחן מתיר, ומה שצריך לאמן. */
  const acts = el('div', 'acts');
  const pager = el('div', 'grades');
  pager.style.gridTemplateColumns = 'repeat(' + RUN.items.length + ',1fr)';
  RUN.items.forEach((x, k) => {
    const answered = itemId(x) in RUN.answers;
    const b = el('button', 'grade' + (k === RUN.i ? ' g3' : ''),
      (k + 1) + (answered ? '<small>✓</small>' : '<small>—</small>'));
    b.onclick = () => { RUN.i = k; paintSection(); };
    pager.appendChild(b);
  });
  const fin = el('button', 'btn', 'סיום הפרק');
  fin.onclick = endSection;
  const hint = el('div', 'note',
    'אין צבירת זמן בין פרקים — אם נשאר זמן, כדאי לחזור ולבדוק. ואף פעם אל תשאיר ריק: אין קנס על טעות.');
  acts.append(pager, fin, hint);
  c.append(mid, acts);

  const box2 = openMode(c, { i: RUN.i, n: RUN.items.length, right: '', close: () => { RUN.ended = true; clearInterval(RUN._t); RUN = null; A.render(); } }, 'exam');
  const bar = box2.querySelector('.sbar .cnt');
  bar.id = 'clock'; bar.className = 'clock'; bar.textContent = fmt(RUN.left);
}

async function endSection() {
  RUN.ended = true; clearInterval(RUN._t);
  await scale();
  const used = RUN.seconds - RUN.left;
  let ok = 0, blank = 0, changedGood = 0, changedBad = 0;
  RUN.items.forEach((it) => {
    const id = itemId(it), a = RUN.answers[id], fp = RUN.firstPass[id];
    if (a == null) { blank++; return; }
    const right = a === it.answer;
    if (right) ok++;
    if (fp != null && fp !== a) (right ? changedGood++ : changedBad++);
    logAttempt(id, a, right, 0, fp === a ? 1 : 2);
  });

  const c = el('div', 'card');
  const mid = el('div', 'mid');
  const est = toScale(ok, RUN.items.length);
  mid.innerHTML = '<span class="eyebrow">תוצאה</span>' +
    '<div class="hero"><div class="big">' + ok + '/' + RUN.items.length + '</div>' +
    (est ? '<div class="cap">קצב של <b>' + est + '</b> בסולם 50–150</div>' : '') +
    '<div class="cap">' + fmt(used) + ' מתוך ' + fmt(RUN.seconds) + ' נוצלו</div></div>';
  if (blank) mid.appendChild(el('div', 'note',
    '<b style="color:var(--bad)">' + blank + ' נשארו ריקות.</b> זה הפסד מיותר — במבחן אין קנס על טעות, ' +
    'וההוראה הרשמית היא לנחש.'));
  if (changedGood || changedBad) mid.appendChild(el('div', 'note',
    'במעבר השני שינית ' + (changedGood + changedBad) + ' תשובות: ' + changedGood + ' לטובה, ' + changedBad + ' לרעה.'));

  const list = el('div', 'sec');
  RUN.items.forEach((it, k) => {
    const a = RUN.answers[itemId(it)];
    const head = el('div', 'sec');
    head.appendChild(el('span', 'eyebrow',
      'שאלה ' + (k + 1) + ' · ' + (a == null ? 'לא נענתה' : a === it.answer ? 'נכון' : 'שגוי')));
    head.appendChild(el('div', 'ex', A.examSentence(it.stem)));
    head.appendChild(whySC(it, a));
    list.appendChild(head);
  });
  const acts = el('div', 'acts');
  const again = el('button', 'btn', 'פרק נוסף');
  again.onclick = () => startSection(RUN.kindUsed || 'sc', RUN.items.length, RUN.seconds, RUN.title);
  const out = el('button', 'btn ghost sm', 'חזרה');
  out.onclick = () => { RUN = null; closeStudy(); A.render(); };
  acts.append(again, out);
  c.append(mid, list, acts);
  const b = openMode(c, { i: 1, n: 1, right: '', close: () => { RUN = null; A.render(); } }, 'exam');
  b.querySelector('.sbar .cnt').textContent = '';
}

/* ============================================================
   דריל ב' — מסגרות מגלות
   שני הדפוסים היחידים שהנתונים תומכים בהם: הגדרה בתוך המשפט, וניגוד.
   יחד הם כ-19% מפריטי השלמת המשפטים, ומכריעים כשהם נוכחים.
   ============================================================ */
let FR = null;
async function startFrames() {
  const rows = await A.bank('sc');
  if (!rows) { toast('התחבר כדי לטעון את בנק השאלות'); return; }
  const pool = rows.filter((r) => frameOf(r.stem));
  if (!pool.length) { toast('לא נמצאו פריטים מתאימים'); return; }
  FR = { q: shuffle(pool).slice(0, 12), i: 0, ok: 0 };
  paintFrame();
}
function paintFrame() {
  if (FR.i >= FR.q.length) {
    const c = el('div', 'card');
    c.innerHTML = '<div class="mid"><span class="eyebrow">סיימת</span>' +
      '<div class="head-en">' + FR.ok + '/' + FR.q.length + '</div>' +
      '<div class="he">זיהוי מסגרות</div></div>';
    const a = el('div', 'acts'); const b = el('button', 'btn', 'חזרה');
    b.onclick = () => { FR = null; closeStudy(); A.render(); };
    a.appendChild(b); c.appendChild(a);
    openMode(c, { i: 1, n: 1, right: '', close: () => { FR = null; A.render(); } }, 'frame');
    return;
  }
  const it = FR.q[FR.i], f = frameOf(it.stem);
  const c = el('div', 'card');
  const mid = el('div', 'mid');
  mid.innerHTML = '<span class="eyebrow">איזו מסגרת פועלת כאן? · ' + (FR.i + 1) + '/' + FR.q.length + '</span>' +
    '<div class="ex" style="font-size:var(--fs-lg)">' + A.examSentence(it.stem) + '</div>';
  const acts = el('div', 'acts');
  const g = el('div', 'grades'); g.style.gridTemplateColumns = 'repeat(2,1fr)';
  const pick = (choice) => {
    const right = choice === f;
    if (right) FR.ok++;
    acts.innerHTML = '';
    const why = f === 'definition'
      ? 'המשפט מגדיר את המילה החסרה בעצמו — הפסוקית או האפוזיציה אומרות לך מה היא.'
      : 'יש כאן היפוך. המילה החסרה חייבת להיות בקוטביות ההפוכה מהחצי השני של המשפט.';
    mid.appendChild(el('div', 'note',
      (right ? '<b style="color:var(--good)">נכון.</b> ' : '<b style="color:var(--bad)">לא.</b> ') + why));
    mid.appendChild(whySC(it, -1));
    const nx = el('button', 'btn', 'הבא');
    nx.onclick = () => { FR.i++; paintFrame(); };
    acts.appendChild(nx);
  };
  [['הגדרה בתוך המשפט', 'definition'], ['ניגוד / היפוך', 'contrast']].forEach(([t, k]) => {
    const b = el('button', 'grade', esc(t)); b.onclick = () => pick(k); g.appendChild(b);
  });
  acts.appendChild(g);
  c.append(mid, acts);
  openMode(c, { i: FR.i, n: FR.q.length, right: '', close: () => { FR = null; A.render(); } }, 'frame');
}

/* ============================================================
   דריל ג' — צייד המלכודות (ניסוח מחדש)
   בוחרים נכון, ואז מתייגים למה כל מסיח שגוי. הטקסונומיה מהניתוח של
   232 הפריטים; ההיוריסטיקה "לעולם לא הקצרה ביותר" נבדקת על הפריט עצמו.
   ============================================================ */
const TRAPS = [
  ['added',    'עובדה שלא נאמרה', 'מוסיף סיבה, מניע או תוצאה שאין במקור'],
  ['predicate','החלפת פרדיקט',    'מחליף מילה אחת בשכנה סבירה שמשנה את הטענה'],
  ['reversal', 'היפוך כיוון',      'הופך כיוון סיבתי, זמני או השוואתי'],
  ['degree',   'הגזמה או החלשה',  'מנפח או מחליש את עוצמת הטענה'],
  ['swap',     'החלפת מבצע',       'מחליף מי עושה למי, או על מה הכמת חל'],
  ['partial',  'פרט צדדי',         'נכון, אבל מפספס את הטענה המרכזית'],
];
let TR = null;
async function startTraps() {
  const rows = await A.bank('rs');
  if (!rows) { toast('התחבר כדי לטעון את בנק השאלות'); return; }
  TR = { q: shuffle(rows.slice()).slice(0, 8), i: 0, ok: 0 };
  paintTrap();
}
function paintTrap() {
  if (TR.i >= TR.q.length) {
    const c = el('div', 'card');
    c.innerHTML = '<div class="mid"><span class="eyebrow">סיימת</span>' +
      '<div class="head-en">' + TR.ok + '/' + TR.q.length + '</div>' +
      '<div class="he">ניסוח מחדש</div></div>';
    const a = el('div', 'acts'); const b = el('button', 'btn', 'חזרה');
    b.onclick = () => { TR = null; closeStudy(); A.render(); };
    a.appendChild(b); c.appendChild(a);
    openMode(c, { i: 1, n: 1, right: '', close: () => { TR = null; A.render(); } }, 'trap');
    return;
  }
  const it = TR.q[TR.i];
  const c = el('div', 'card');
  const mid = el('div', 'mid');
  mid.innerHTML = '<span class="eyebrow">ניסוח מחדש · ' + (TR.i + 1) + '/' + TR.q.length + '</span>' +
    '<div class="ex" style="font-size:var(--fs-md)">' + esc(it.stem) + '</div>';
  const box = el('div', 'opts');
  const acts = el('div', 'acts');
  let answered = false;
  it.options.forEach((o, k) => {
    const b = el('button', 'opt', '<span class="num">(' + (k + 1) + ')</span>' + esc(o));
    b.onclick = () => {
      if (answered) return; answered = true;
      const right = k === it.answer;
      if (right) TR.ok++;
      logAttempt(itemId(it), k, right, 0, 1);
      Array.from(box.children).forEach((n, j) => {
        n.className = 'opt' + (j === it.answer ? ' right' : j === k ? ' wrong' : '');
      });
      acts.innerHTML = '';
      acts.appendChild(whyRS(it, k));
      /* התיוג הוא העיבוד העמוק: לבחור נכון זו בדיקה, לנמק זה לימוד. */
      const lab = el('div', 'why');
      lab.appendChild(el('h4', '', 'תייג את המלכודת בכל מסיח'));
      it.options.forEach((o, j) => {
        if (j === it.answer) return;
        const row = el('div', 'opt-row');
        row.innerHTML = '<div class="mk">' + (j + 1) + '</div>';
        const sel = el('select', 't');
        sel.innerHTML = '<option value="">— בחר —</option>' +
          TRAPS.map(([k2, he]) => '<option value="' + k2 + '">' + he + '</option>').join('');
        sel.onchange = () => {
          const t = TRAPS.find((x) => x[0] === sel.value);
          if (t) { put('attempt', itemId(it) + ':trap' + j, { t: t[0], at: Date.now() }); toast(t[2]); }
        };
        const cell = el('div'); cell.appendChild(sel);
        row.appendChild(cell);
        lab.appendChild(row);
      });
      acts.appendChild(lab);
      const nx = el('button', 'btn', 'הבא');
      nx.onclick = () => { TR.i++; paintTrap(); };
      acts.appendChild(nx);
    };
    box.appendChild(b);
  });
  mid.appendChild(box);
  c.append(mid, acts);
  openMode(c, { i: TR.i, n: TR.q.length, right: '', close: () => { TR = null; A.render(); } }, 'trap');
}

/* ============================================================
   דריל ד' — תבניות הבנת הנקרא
   שתי צורות: ספרינט "מטרת הפסקה" (20% מכל שאלות הפרק), וקטע מלא
   עם חמש שאלות בסדר המבחן.
   ============================================================ */
let RC = null;
async function startRC(mode) {
  const [qs, ps] = await Promise.all([A.bank('rc'), A.bank('passage')]);
  if (!qs || !ps) { toast('התחבר כדי לטעון את בנק השאלות'); return; }
  const byId = {}; ps.forEach((p) => { byId[p.id] = p; });
  if (mode === 'sprint') {
    const pool = qs.filter((q) => rcType(q.stem).k === 'purpose_para' && byId[q.passage]);
    RC = { mode, q: shuffle(pool).slice(0, 10), i: 0, ok: 0, ps: byId };
  } else {
    const p = ps[(Math.random() * ps.length) | 0];
    const set = qs.filter((q) => q.passage === p.id).sort((a, b) => a.n - b.n);
    if (!set.length) { toast('נסה שוב'); return; }
    RC = { mode, passage: p, q: set, i: 0, ok: 0, ps: byId, showText: true };
  }
  paintRC();
}
/* הפסקה שהשאלה מדברת עליה — כדי שספרינט "מטרת הפסקה" יראה רק אותה. */
const ORD = { first: 0, second: 1, third: 2, fourth: 3, fifth: 4 };
function paraOf(text, stem) {
  const m = stem.match(/main purpose of the (\w+) paragraph/i);
  const parts = text.split(/\s*\(\d+\)\s*/).filter((x) => x.trim().length > 40);
  if (!m || !parts.length) return null;
  const key = m[1].toLowerCase();
  const i = key === 'last' ? parts.length - 1 : ORD[key];
  return i == null ? null : parts[Math.min(i, parts.length - 1)];
}

/* הקטע נשאר על המסך לאורך כל חמש השאלות. בגרסה הקודמת הוא הוצג רק
   בשאלה הראשונה ואז נעלם — ואי אפשר לענות על שאלת הבנת נקרא בלי הטקסט. */
function passagePanel(text, folded) {
  const box = el('div', 'passage' + (folded ? ' folded' : ''));
  box.innerHTML = esc(text).replace(/\((\d{1,2})\)/g, '<span class="pn">$1</span>');
  const btn = el('button', 'fold', folded ? 'הצג את הקטע המלא' : 'כווץ את הקטע');
  btn.onclick = () => {
    const now = box.classList.toggle('folded');
    btn.textContent = now ? 'הצג את הקטע המלא' : 'כווץ את הקטע';
    if (!now) box.scrollTop = 0;
  };
  const wrap = el('div');
  wrap.style.cssText = 'width:100%;display:flex;flex-direction:column;align-items:center';
  wrap.append(box, btn);
  return wrap;
}

function paintRC() {
  if (RC.i >= RC.q.length) {
    const c = el('div', 'card');
    c.innerHTML = '<div class="mid"><span class="eyebrow">סיימת</span>' +
      '<div class="hero"><div class="big">' + RC.ok + '/' + RC.q.length + '</div>' +
      '<div class="cap">הבנת הנקרא</div></div></div>';
    const a = el('div', 'acts');
    const again = el('button', 'btn', RC.mode === 'sprint' ? 'עוד ספרינט' : 'קטע נוסף');
    again.onclick = () => startRC(RC.mode);
    const b = el('button', 'btn ghost sm', 'חזרה');
    b.onclick = () => { RC = null; closeStudy(); A.render(); };
    a.append(again, b); c.appendChild(a);
    openMode(c, { i: 1, n: 1, right: '', close: () => { RC = null; A.render(); } }, 'read');
    return;
  }
  const q = RC.q[RC.i], t = rcType(q.stem);
  const p = RC.mode === 'sprint' ? RC.ps[q.passage] : RC.passage;
  const c = el('div', 'card');
  const mid = el('div', 'mid');

  mid.appendChild(el('span', 'eyebrow', t.he + ' · שאלה ' + (RC.i + 1) + ' מתוך ' + RC.q.length));
  if (RC.mode === 'sprint') {
    mid.appendChild(el('div', 'passage', esc(paraOf(p.text, q.stem) || p.text)));
  } else {
    mid.appendChild(passagePanel(p.text, RC.i > 0));
  }
  mid.appendChild(el('div', 'def', esc(q.stem)));

  const box = el('div', 'opts');
  const acts = el('div', 'acts');
  let answered = false;
  q.options.forEach((o, k) => {
    const b = el('button', 'opt', '<span class="num">(' + (k + 1) + ')</span>' + esc(o));
    b.onclick = () => {
      if (answered) return; answered = true;
      const right = k === q.answer;
      if (right) RC.ok++;
      logAttempt(itemId(q), k, right, 0, 1);
      Array.from(box.children).forEach((n, j) => {
        n.className = 'opt' + (j === q.answer ? ' right' : j === k ? ' wrong' : '');
      });
      acts.innerHTML = '';
      const why = el('div', 'why');
      why.innerHTML = '<h4>' + esc(t.he) + ' — איך תוקפים</h4>' +
        '<div class="note">' + esc(RECIPE[t.k]) + '</div>';
      const ord = q.stem.match(/(first|second|third|fourth|fifth|last) paragraph/i);
      if (ord) why.innerHTML += '<div class="note">התשובה נמצאת ב<b>פסקה ה' +
        ({ first: 'ראשונה', second: 'שנייה', third: 'שלישית', fourth: 'רביעית',
           fifth: 'חמישית', last: 'אחרונה' }[ord[1].toLowerCase()]) + '</b>. חזור אליה ואמת.</div>';
      acts.appendChild(why);
      const nx = el('button', 'btn', RC.i + 1 >= RC.q.length ? 'סיום' : 'הבא');
      nx.onclick = () => { RC.i++; paintRC(); };
      acts.appendChild(nx);
    };
    box.appendChild(b);
  });
  mid.appendChild(box);
  if (RC.mode !== 'sprint' && RC.i === 0) {
    acts.appendChild(el('div', 'note',
      'השאלות עוקבות אחרי סדר הקטע ב‑92% מהמקרים. סרוק מלמעלה למטה פעם אחת ואל תקפוץ אחורה.'));
  }
  c.append(mid, acts);
  openMode(c, { i: RC.i, n: RC.q.length, right: '', close: () => { RC = null; A.render(); } }, 'read');
}

/* ============================================================
   משחקים
   ============================================================ */

/* --- מגדל המילים: זיהוי מהיר תחת לחץ, בדיוק המיומנות שהמבחן מודד --- */
let TW = null;
function startTower() {
  const words = [];
  S.words.forEach((o, w) => { if (o.def) words.push(o); });
  if (words.length < 8) { toast('צריך יותר מילים עם משמעות'); return; }
  TW = { pool: words, lives: 3, score: 0, best: pref('towerBest', 0), speed: 7000 };
  towerRound();
}
function towerRound() {
  if (TW.lives <= 0) {
    if (TW.score > TW.best) setPref('towerBest', TW.score);
    const c = el('div', 'card');
    c.innerHTML = '<div class="mid"><span class="eyebrow">נגמרו החיים</span>' +
      '<div class="head-en">' + TW.score + '</div>' +
      '<div class="he">שיא אישי: ' + Math.max(TW.best, TW.score) + '</div></div>';
    const a = el('div', 'acts');
    const again = el('button', 'btn', 'עוד סיבוב'); again.onclick = startTower;
    const out = el('button', 'btn ghost sm', 'חזרה');
    out.onclick = () => { TW = null; closeStudy(); A.render(); };
    a.append(again, out); c.appendChild(a);
    openMode(c, { i: 1, n: 1, right: '', close: () => { TW = null; A.render(); } }, 'tower');
    return;
  }
  const target = TW.pool[(Math.random() * TW.pool.length) | 0];
  const opts = shuffle([target].concat(
    shuffle(TW.pool.filter((x) => x.w !== target.w)).slice(0, 3)));
  const c = el('div', 'card');
  const mid = el('div', 'mid');
  mid.innerHTML = '<span class="eyebrow">מגדל המילים · ' + TW.score + ' נק׳ · ' +
    '♥'.repeat(TW.lives) + '</span>' +
    '<div class="head-en">' + esc(target.w) + '</div>' +
    '<div class="bar" style="width:100%;max-width:46ch"><i id="twbar" style="width:100%;background:var(--accent)"></i></div>';
  const box = el('div', 'opts');
  let done = false;
  const finish = (right) => {
    if (done) return; done = true;
    clearInterval(TW._t);
    if (right) { TW.score++; TW.speed = Math.max(2600, TW.speed - 180); }
    else TW.lives--;
    bump({ rev: 0 });
    setTimeout(towerRound, right ? 260 : 900);
  };
  opts.forEach((o) => {
    const b = el('button', 'opt', esc(o.def));
    b.onclick = () => {
      const right = o.w === target.w;
      b.className = 'opt ' + (right ? 'right' : 'wrong');
      if (!right) Array.from(box.children).forEach((n) => {
        if (n.textContent === target.def) n.className = 'opt right';
      });
      finish(right);
    };
    box.appendChild(b);
  });
  mid.appendChild(box);
  c.appendChild(mid);
  openMode(c, { i: 1, n: 1, right: 'שיא ' + TW.best, close: () => { clearInterval(TW._t); TW = null; A.render(); } }, 'tower');
  const t0 = Date.now();
  TW._t = setInterval(() => {
    const left = 1 - (Date.now() - t0) / TW.speed;
    const bar = document.querySelector('#twbar');
    if (bar) bar.style.width = Math.max(0, left * 100) + '%';
    if (left <= 0) { Array.from(box.children).forEach((n) => { if (n.textContent === target.def) n.className = 'opt right'; }); finish(false); }
  }, 60);
}

/* --- זוגות מבלבלים: המילים שהמבחן מציב זו לצד זו בכוונה --- */
let PR = null;
async function startPairs() {
  let pairs = [];
  try { pairs = await fetch('data/pairs.json').then((r) => r.json()); } catch (e) {}
  const have = pairs.filter((p) => S.words.get(p[0]) && S.words.get(p[1]) &&
                                   S.words.get(p[0]).def && S.words.get(p[1]).def);
  if (have.length < 4) { toast('עוד אין מספיק זוגות עם משמעות'); return; }
  const pick = shuffle(have.slice()).slice(0, 4);
  const cards = [];
  pick.forEach(([a, b], gi) => {
    [a, b].forEach((w) => {
      cards.push({ id: w + ':w', g: w, face: w, kind: 'w' });
      cards.push({ id: w + ':d', g: w, face: S.words.get(w).def, kind: 'd' });
    });
  });
  PR = { cards: shuffle(cards), open: [], matched: {}, moves: 0, pairsN: cards.length / 2 };
  paintPairs();
}
function paintPairs() {
  const c = el('div', 'card');
  const mid = el('div', 'mid');
  const done = Object.keys(PR.matched).length;
  mid.innerHTML = '<span class="eyebrow">זוגות מבלבלים · ' + done + '/' + PR.pairsN + ' · ' + PR.moves + ' מהלכים</span>' +
    '<div class="tiny dim">התאם כל מילה למשמעות שלה. החפיסה נזרעה בזוגות שהמבחן באמת מבלבל ביניהם.</div>';
  const grid = el('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:7px;width:100%;max-width:46ch';
  PR.cards.forEach((cd, i) => {
    const isOpen = PR.open.includes(i) || PR.matched[cd.g];
    const b = el('button', 'opt' + (PR.matched[cd.g] ? ' right' : isOpen ? ' pick' : ''),
      isOpen ? esc(cd.face) : '<span style="opacity:.35">•••</span>');
    b.style.cssText = 'min-height:64px;font-size:' + (cd.kind === 'w' ? 'var(--fs-md)' : 'var(--fs-sm)');
    if (!isOpen && PR.open.length < 2) b.onclick = () => flip(i);
    grid.appendChild(b);
  });
  mid.appendChild(grid);
  c.appendChild(mid);
  if (done === PR.pairsN) {
    const a = el('div', 'acts');
    const again = el('button', 'btn', 'עוד סיבוב'); again.onclick = startPairs;
    const out = el('button', 'btn ghost sm', 'חזרה');
    out.onclick = () => { PR = null; closeStudy(); A.render(); };
    a.append(again, out); c.appendChild(a);
  }
  openMode(c, { i: done, n: PR.pairsN, right: '', close: () => { PR = null; A.render(); } }, 'pair');
}
function flip(i) {
  PR.open.push(i);
  if (PR.open.length === 2) {
    PR.moves++;
    const [a, b] = PR.open.map((k) => PR.cards[k]);
    if (a.g === b.g && a.kind !== b.kind) { PR.matched[a.g] = 1; PR.open = []; }
    else setTimeout(() => { PR.open = []; paintPairs(); }, 900);
  }
  paintPairs();
}

/* --- רביעיות: 16 מילים, ארבע קבוצות משמעות. עיבוד סמנטי עמוק --- */
let QD = null;
async function startQuads() {
  let groups = [];
  try { groups = await fetch('data/quads.json').then((r) => r.json()); } catch (e) {}
  const ok = groups.filter((g) => g.words.every((w) => S.words.get(w)));
  if (ok.length < 4) { toast('חבילת הרביעיות עוד לא מוכנה'); return; }
  /* פאזל יומי: אותו זרע לשני הלומדים, כך שאפשר להשוות תוצאות. */
  const seed = today().split('-').join('') | 0;
  const rot = ok.slice();
  const start = seed % Math.max(1, rot.length - 3);
  const pick = rot.slice(start, start + 4);
  QD = { groups: pick, tiles: shuffle(pick.flatMap((g) => g.words)), sel: [], solved: [], mistakes: 0 };
  paintQuads();
}
function paintQuads() {
  const c = el('div', 'card');
  const mid = el('div', 'mid');
  mid.innerHTML = '<span class="eyebrow">רביעיות · הפאזל של ' + heDate(today()) + '</span>' +
    '<div class="tiny dim">מצא ארבע קבוצות של ארבע מילים שחולקות משמעות. ' +
    (4 - QD.mistakes) + ' טעויות נותרו.</div>';
  QD.solved.forEach((g) => {
    mid.appendChild(el('div', 'assoc',
      '<span class="eyebrow">' + esc(g.label) + '</span>' +
      '<span style="direction:ltr">' + g.words.map(esc).join(' · ') + '</span>'));
  });
  const grid = el('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:6px;width:100%;max-width:46ch';
  QD.tiles.forEach((w) => {
    const b = el('button', 'opt' + (QD.sel.includes(w) ? ' pick' : ''), esc(w));
    b.style.cssText = 'min-height:54px;text-align:center;font-size:var(--fs-md)';
    b.onclick = () => {
      const i = QD.sel.indexOf(w);
      if (i >= 0) QD.sel.splice(i, 1); else if (QD.sel.length < 4) QD.sel.push(w);
      paintQuads();
    };
    grid.appendChild(b);
  });
  mid.appendChild(grid);
  const acts = el('div', 'acts');
  if (QD.solved.length === QD.groups.length || QD.mistakes >= 4) {
    const win = QD.solved.length === QD.groups.length;
    mid.insertAdjacentHTML('afterbegin',
      '<div class="head-en">' + (win ? 'Solved' : 'Out') + '</div>');
    if (!win) QD.groups.filter((g) => !QD.solved.includes(g)).forEach((g) =>
      mid.appendChild(el('div', 'note', '<b>' + esc(g.label) + ':</b> <span style="direction:ltr">' + g.words.map(esc).join(' · ') + '</span>')));
    const out = el('button', 'btn', 'חזרה');
    out.onclick = () => { QD = null; closeStudy(); A.render(); };
    acts.appendChild(out);
  } else {
    const go = el('button', 'btn', 'בדוק');
    go.disabled = QD.sel.length !== 4;
    go.onclick = () => {
      const hit = QD.groups.find((g) => !QD.solved.includes(g) &&
        QD.sel.every((w) => g.words.includes(w)));
      if (hit) {
        QD.solved.push(hit);
        QD.tiles = QD.tiles.filter((w) => !hit.words.includes(w));
      } else { QD.mistakes++; toast('לא זו הקבוצה'); }
      QD.sel = []; paintQuads();
    };
    acts.appendChild(go);
  }
  c.append(mid, acts);
  openMode(c, { i: QD.solved.length, n: QD.groups.length, right: '', close: () => { QD = null; A.render(); } }, 'quad');
}

/* --- בליץ 90: מיקרו-סשן לתור בסופר --- */
async function startBlitz() {
  const due = A.dueList();
  const pool = (due.length ? due : A.newList().slice(0, 40)).slice(0, 60);
  if (!pool.length) { toast('אין מה לתרגל'); return; }
  let i = 0, ok = 0, left = 90;
  const t = setInterval(() => {
    left--;
    const c = document.querySelector('#clock');
    if (c) { c.textContent = left + 's'; c.className = 'clock' + (left <= 15 ? ' low' : ''); }
    if (left <= 0) { clearInterval(t); done(); }
  }, 1000);
  const done = () => {
    clearInterval(t);
    const best = pref('blitzBest', 0);
    if (ok > best) setPref('blitzBest', ok);
    const c = el('div', 'card');
    c.innerHTML = '<div class="mid"><span class="eyebrow">בליץ 90</span>' +
      '<div class="head-en">' + ok + '</div><div class="he">שיא: ' + Math.max(best, ok) + '</div></div>';
    const a = el('div', 'acts'); const b = el('button', 'btn', 'חזרה');
    b.onclick = () => { closeStudy(); A.render(); };
    a.appendChild(b); c.appendChild(a);
    const box = openStudy(c, { i: 1, n: 1, right: '', close: () => A.render() });
    box.querySelector('.sbar .cnt').textContent = '';
  };
  const step = () => {
    if (left <= 0 || i >= pool.length) return done();
    const w = pool[i], o = S.words.get(w);
    const c = el('div', 'card');
    const mid = el('div', 'mid');
    mid.innerHTML = '<span class="eyebrow">בליץ 90 · ' + ok + ' נכונות</span>' +
      '<div class="head-en">' + esc(w) + '</div>' +
      (o && o.def ? '' : '<div class="tiny dim">אין עדיין הגדרה למילה הזאת</div>');
    const acts = el('div', 'acts');
    const g = el('div', 'grades'); g.style.gridTemplateColumns = 'repeat(2,1fr)';
    const grade = (n) => {
      const cd = card(w) || { r: 0, l: 0 };
      A.schedule(cd, n); put('cards', w, cd);
      bump({ rev: 1, ok: n >= 3 ? 1 : 0 });
      if (n >= 3) ok++;
      i++; step();
    };
    const show = el('button', 'btn', 'הצג');
    show.onclick = () => {
      acts.innerHTML = '';
      mid.innerHTML = '<div class="head-en">' + esc(w) + '</div>' + (o ? A.meaning(o, false) : '');
      [[1, 'לא'], [3, 'ידעתי']].forEach(([n, t]) => {
        const b = el('button', 'grade ' + (n === 1 ? 'g1' : 'g3'), esc(t));
        b.onclick = () => grade(n); g.appendChild(b);
      });
      acts.appendChild(g);
    };
    acts.appendChild(show);
    c.append(mid, acts);
    const box = openStudy(c, { i, n: pool.length, right: '', close: () => { clearInterval(t); A.render(); } });
    const cl = box.querySelector('.sbar .cnt');
    cl.id = 'clock'; cl.className = 'clock'; cl.textContent = left + 's';
  };
  step();
}

/* ============================================================
   מסכים
   ============================================================ */
function tile(v, title, sub, fn, badge) {
  const b = el('button', 'btn ghost');
  b.style.cssText = 'text-align:right;padding:14px';
  b.innerHTML = '<div style="font-weight:700;font-size:var(--fs-md);color:var(--text)">' + esc(title) +
    (badge ? ' <span class="pill good">' + esc(badge) + '</span>' : '') + '</div>' +
    '<div class="tiny muted" style="font-weight:400;margin-top:2px">' + esc(sub) + '</div>';
  b.onclick = fn;
  v.appendChild(b);
}

function menu(v) {
  const signed = !!(window.Cloud && window.Cloud.user);
  v.appendChild(el('span', 'eyebrow', 'תרגול בפורמט המבחן'));
  if (!signed) {
    v.appendChild(el('div', 'note', 'בנק השאלות דורש התחברות — הכפתור למעלה מימין.'));
  }
  tile(v, 'פרק אמיתי — השלמת משפטים', '4 שאלות · 4:00 · ניווט חופשי. 63% מהניקוד.',
    () => startSection('sc', 4, 240, 'השלמת משפטים'));
  tile(v, 'מסגרות מגלות', 'שני הדפוסים שמכריעים את השאלה כשהם נוכחים.', startFrames);
  tile(v, 'צייד המלכודות', 'ניסוח מחדש — לבחור נכון, ואז להבין למה השאר שגויים. 32% מהניקוד.',
    startTraps);
  tile(v, 'ספרינט מטרת הפסקה', 'התבנית הבודדת הגדולה ביותר בהבנת הנקרא — 20% מהשאלות.',
    () => startRC('sprint'));
  tile(v, 'קטע מלא', 'קטע אמיתי וחמש שאלות בסדר המבחן.', () => startRC('full'));

  const s = el('div', 'sec');
  s.appendChild(el('span', 'eyebrow', 'סימולציות רשמיות'));
  s.appendChild(el('div', 'note',
    'למאל"ו יש שלוש סימולציות חינם בפורמט אמירנט המלא. הן משלימות את התרגול כאן — ' +
    'הפורמט האמיתי, כולל האדפטיביות.<br>' +
    '<a href="https://amirnet-practice.nite.org.il/amirnet.html" target="_blank" rel="noopener" ' +
    'style="color:var(--accent)">amirnet-practice.nite.org.il</a>'));
  v.appendChild(s);
  progressBlock(v);
}

function play(v) {
  v.appendChild(el('span', 'eyebrow', 'משחקים'));
  tile(v, 'רביעיות', 'שש-עשרה מילים, ארבע קבוצות משמעות. פאזל יומי זהה לשניכם.', startQuads);
  tile(v, 'מגדל המילים', 'זיהוי תחת שעון. המבחן נותן 60 שניות לשאלה.', startTower);
  tile(v, 'זוגות מבלבלים', 'המילים שהמבחן מציב זו לצד זו בכוונה.', startPairs);
  tile(v, 'בליץ 90', 'תשעים שניות. לתור בסופר.', startBlitz,
    pref('blitzBest', 0) ? 'שיא ' + pref('blitzBest', 0) : '');
  printBlock(v);
}

/* ---------- התקדמות ---------- */
async function progressBlock(v) {
  await scale();
  const at = attempts();
  const ids = Object.keys(at).filter((k) => !k.includes(':trap'));
  const s = el('div', 'sec');
  s.appendChild(el('span', 'eyebrow', 'האם אני בקצב ל-134?'));
  if (!ids.length) {
    s.appendChild(el('div', 'note', 'עוד לא ענית על שאלות מבחן. אחרי פרק אחד יופיע כאן אומדן.'));
    v.appendChild(s); return;
  }
  const by = { sc: [0, 0], rs: [0, 0], rc: [0, 0] };
  ids.forEach((k) => {
    const kind = k.split(':')[0];
    if (!by[kind]) return;
    by[kind][1]++; if (at[k].ok) by[kind][0]++;
  });
  /* משקלים לפי מבנה הבחינה: 12 השלמת משפטים, 6 ניסוח מחדש, 5 הבנת הנקרא. */
  const Wt = { sc: 12, rs: 6, rc: 5 };
  let num = 0, den = 0;
  Object.keys(Wt).forEach((k) => { if (by[k][1]) { num += by[k][0] / by[k][1] * Wt[k]; den += Wt[k]; } });
  const acc = den ? num / den : 0;
  const est = SCALE ? SCALE[Math.max(0, Math.min(44, Math.round(acc * 44)))] : null;
  const lo = SCALE ? SCALE[Math.max(0, Math.round(acc * 44) - 3)] : null;
  const hi = SCALE ? SCALE[Math.min(44, Math.round(acc * 44) + 3)] : null;

  if (est) {
    s.appendChild(el('div', 'figs',
      '<div class="fig"><span class="n">' + lo + '–' + hi + '</span><span class="k">טווח משוער</span></div>' +
      '<div class="fig ' + (est >= 134 ? 'new' : 'due') + '"><span class="n">' + est + '</span><span class="k">אמצע</span></div>' +
      '<div class="fig"><span class="n">' + ids.length + '</span><span class="k">שאלות</span></div>'));
    s.appendChild(el('div', 'note',
      est >= 134
        ? '<b style="color:var(--good)">אתה מעל סף הפטור בתרגול.</b> שמור על זה והרחב את מספר השאלות.'
        : 'צריך עוד <b>' + Math.max(1, Math.round((0.855 - acc) * 44)) + '</b> תשובות נכונות מתוך 44 ' +
          'כדי לחצות את 134. הזולות ביותר נמצאות בהשלמת משפטים.'));
  }
  const rows = el('div', 'sec');
  [['sc', 'השלמת משפטים', 12], ['rs', 'ניסוח מחדש', 6], ['rc', 'הבנת הנקרא', 5]].forEach(([k, he, w]) => {
    if (!by[k][1]) return;
    const pct = Math.round(by[k][0] / by[k][1] * 100);
    const row = el('div', 'item');
    row.innerHTML = '<div class="b"><b>' + esc(he) + '</b> · ' + w + ' שאלות במבחן</div>' +
      '<div class="pill ' + (pct >= 85 ? 'good' : 'bad') + '">' + pct + '%</div>';
    rows.appendChild(row);
  });
  s.appendChild(rows);
  s.appendChild(el('div', 'note',
    'האומדן מבוסס על טבלת המעבר הרשמית מציון גלם לסולם 50–150. הוא מתאר את הרמה שלך על ' +
    'פריטים אמיתיים; אמירנט עצמו אדפטיבי, ולכן זה כיוון ולא הבטחה.'));
  v.appendChild(s);
}

/* ---------- הדפסה לשבת ופיוס ---------- */
function printBlock(v) {
  const s = el('div', 'sec');
  s.appendChild(el('span', 'eyebrow', 'חבילת הדפסה לשבת'));

  /* איזה ימים סגורים בטווח הקרוב — משם נגזר מה להדפיס. */
  const days = [];
  for (let i = 0; i < 10; i++) { const d = addDays(today(), i); if (A.isOff(d)) days.push(d); }
  const upto = days.length ? days[days.length - 1] : addDays(today(), 2);
  const cs = ns('cards'), due = [];
  for (const w in cs) if (cs[w].d && cs[w].d <= upto) due.push(w);

  s.appendChild(el('div', 'note', days.length
    ? 'הימים הסגורים הקרובים: ' + days.map(heDate).join(' · ') + '. ' +
      '<b>' + due.length + '</b> מילים יגיעו לפירעון עד אז.'
    : 'אין ימים סגורים בעשרה הימים הקרובים.'));

  const p1 = el('button', 'btn ghost', 'גיליון לימוד · ' + due.length + ' מילים');
  p1.onclick = () => printSheet(due);
  s.appendChild(p1);

  const batch = ns('print');
  const open = Object.keys(batch).filter((k) => !batch[k].reconciled);
  if (open.length) {
    const b = el('button', 'btn', 'סמן מה זכרת · ' + (batch[open[0]].words || []).length + ' מילים');
    b.onclick = () => reconcile(open[0]);
    s.appendChild(b);
    s.appendChild(el('div', 'note',
      'בלי הסימון הזה התזמון נשבר — המערכת לא יודעת מה קרה בשבת. שלושים שניות לכל הדף.'));
  }
  v.appendChild(s);
}

function printSheet(words) {
  if (!words.length) { toast('אין מילים לפירעון'); return; }
  const id = 'p' + Date.now();
  put('print', id, { words, layout: 'study', at: Date.now(), reconciled: 0 });
  const sheet = el('div', 'sheet');
  sheet.innerHTML = '<h1>אמירנט — ' + heDate(today()) + ' · ' + words.length + ' מילים</h1>';
  words.forEach((w) => {
    const o = S.words.get(w) || { w };
    const row = el('div', 'row');
    row.innerHTML = '<div class="box"></div>' +
      '<div class="w">' + esc(w) + '</div>' +
      '<div><div class="m">' + esc(o.def || '') + ' — ' + esc(o.he || '') + '</div>' +
      '<div class="a">' + esc(A.assoc(w) || '') + '</div></div>';
    sheet.appendChild(row);
  });
  const view = document.querySelector('#view');
  view.innerHTML = '';
  view.appendChild(sheet);
  const back = el('button', 'btn ghost', 'חזרה');
  back.onclick = () => A.render();
  view.appendChild(back);
  setTimeout(() => window.print(), 250);
}

function reconcile(id) {
  const b = ns('print')[id];
  const words = b.words || [];
  const marks = {};
  const c = el('div', 'card');
  const mid = el('div', 'mid');
  mid.innerHTML = '<span class="eyebrow">סמן מה זכרת</span>' +
    '<div class="tiny dim">הקשה אחת לכל מילה. מה שלא תסמן ייחשב כלא נבדק ויחזור לתור.</div>';
  const grid = el('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:6px;width:100%;max-width:46ch';
  words.forEach((w) => {
    const btn = el('button', 'opt', esc(w));
    btn.style.cssText = 'min-height:46px;text-align:center';
    btn.onclick = () => {
      marks[w] = !marks[w];
      btn.className = 'opt ' + (marks[w] ? 'right' : '');
    };
    grid.appendChild(btn);
  });
  mid.appendChild(grid);
  const acts = el('div', 'acts');
  const save = el('button', 'btn', 'שמור');
  save.onclick = () => {
    let n = 0;
    words.forEach((w) => {
      if (!marks[w]) return;
      const cd = card(w) || { r: 0, l: 0 };
      A.schedule(cd, 3); put('cards', w, cd); n++;
    });
    bump({ rev: n, ok: n });
    b.reconciled = Date.now(); put('print', id, b);
    closeStudy(); toast(n + ' מילים עודכנו'); A.render();
  };
  acts.appendChild(save);
  c.append(mid, acts);
  openStudy(c, { i: 0, n: words.length, right: '', close: () => A.render() });
}

window.AMDrills = { menu, play };
if (A.S.ready) A.render();

})();
