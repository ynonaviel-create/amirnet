/* ================= אמירנט — פרקי אמת =================

   התוכנית שלך היא הקורסים של ערן, מילים, וכמה שיותר פרקים. זה המסך
   של החלק השלישי, והוא בנוי סביב כמות: פרק אחרי פרק, בלי חיכוך,
   בלי לחזור על פריט שכבר ראית עד שהמאגר ייגמר.

   מה שהמאגר מאפשר: 116 פרקי השלמת משפטים, 77 ניסוח מחדש, 108 קטעי
   קריאה, ומהם 38 סימולציות מלאות בלי חזרה על פריט.

   על השעון: מאל"ו לא מפרסמת זמן לכל פרק, רק 39 דקות לכלל המבחן על
   7–8 פרקים שמתוכם 1–2 ניסוייים. הקצבתי לפי עומס הקריאה שמדדתי
   בפועל — 1:24 לשאלה כבסיס, מוכפל ב-0.8 להשלמת משפטים, 1.15 לניסוח
   מחדש ו-1.35 להבנת הנקרא — וסך הסימולציה יוצא 32:30, בדיוק היחס
   של 23 השאלות הנספרות מתוך 39 הדקות. זו הקצבה נגזרת ולא רשמית.

   על האדפטיביות: המבחן אדפטיבי ברמת הפרק, והסימולציה כאן לא מדמה
   את זה. בדקתי אם יש דירוג קושי בפריטים — מיקום בפרק מול נדירות
   מילת התשובה נתן r=-0.36 על שמונה נקודות שקופצות בין 1.0 ל-70.6,
   ומול אורך המילה r=-0.18. אין שם אות. לדמות אדפטיביות על דירוג
   שהמצאתי היה מייצר ציון שנשמע מדויק ואינו.
   ============================================================== */
'use strict';

(function () {

const A = window.AM;
const { el, esc, shuffle, toast, ns, put, bump, S } = A;

/* ---------- מפרט הפרקים ---------- */
const SPEC = {
  sc: { he: 'השלמת משפטים', n: 4, sec: 270, mode: 'exam', weight: 12 },
  rs: { he: 'ניסוח מחדש',   n: 3, sec: 285, mode: 'trap', weight: 6 },
  rc: { he: 'הבנת הנקרא',   n: 5, sec: 570, mode: 'read', weight: 5 },
};
/* סדר הפרקים במבחן: 4+4 השלמה · 5 הבנת הנקרא · 3+3 ניסוח · 4 השלמה */
const SIM = ['sc', 'sc', 'rc', 'rs', 'rs', 'sc'];
const TOTALQ = 23;

let SCALE = null;
async function scale() {
  if (!SCALE) { try { SCALE = (await (await fetch('./data/scale.json')).json()).scale; } catch (e) { SCALE = null; } }
  return SCALE;
}
const toScale = (ok, tot) => (SCALE && tot) ? SCALE[Math.max(0, Math.min(44, Math.round(ok / tot * 44)))] : null;
const fmt = (s) => Math.floor(Math.max(0, s) / 60) + ':' + String(Math.max(0, s) % 60).padStart(2, '0');
const itemId = (r) => r.kind + ':' + r.exam + ':' + r.sec + ':' + r.n;

/* ---------- כיסוי המאגר ---------- */
function coverage(rows, kind, passages) {
  const at = ns('attempt');
  const seen = rows.filter((r) => at[itemId(r)]).length;
  if (kind !== 'rc') {
    const per = SPEC[kind].n;
    return { seen, total: rows.length, sections: Math.floor(rows.length / per),
             done: Math.floor(seen / per) };
  }
  /* פרק הבנת הנקרא הוא קטע שלם, ולכן נספרים קטעים עם מספיק שאלות
     ולא סך השאלות חלקי חמש. */
  const by = new Map();
  rows.forEach((q) => {
    if (passages && !passages.has(q.passage)) return;
    if (!by.has(q.passage)) by.set(q.passage, []);
    by.get(q.passage).push(q);
  });
  const usable = [...by.values()].filter((qs) => qs.length >= SPEC.rc.n);
  const done = usable.filter((qs) => qs.some((q) => at[itemId(q)])).length;
  return { seen, total: rows.length, sections: usable.length, done };
}

/* ---------- בחירת פריטים ----------
   פריטים שלא נראו קודמים תמיד. כשהמאגר נגמר מתחילים סבב שני, והמסך
   אומר את זה — חזרה על פריט מוכר היא תרגול אחר, ועדיף לדעת. */
function draw(rows, count, byPassage) {
  const at = ns('attempt');
  const fresh = rows.filter((r) => !at[itemId(r)]);
  const pool = fresh.length >= count ? fresh : rows;
  return { items: shuffle(pool.slice()).slice(0, count), recycled: fresh.length < count };
}

/* ============================================================
   מנוע הפרק
   ============================================================ */
let RUN = null;

function failed() {
  const signed = !!(window.Cloud && window.Cloud.user);
  const c = el('div', 'card'), mid = el('div', 'mid');
  mid.appendChild(A.state(
    signed ? 'הפרק לא נטען' : 'צריך להתחבר',
    signed
      ? (navigator.onLine
          ? 'בנק השאלות לא הגיע מהמסד. ההתקדמות שלך שמורה.<br>נסה שוב, ואם זה חוזר בדוק את החשבון תחת <b>עוד</b>.'
          : 'אין רשת. הלומדה והמשחקים עובדים אופליין; פרקי אמת דורשים חיבור.')
      : 'בנק השאלות יושב מאחורי התחברות — חוברות מאל"ו נושאות איסור הפצה. ' +
        'ההתחברות תחת <b>עוד</b>.',
    { label: 'חזרה', fn: () => { A.closeStudy(); A.render(); } }));
  c.appendChild(mid);
  A.openStudy(c, { i: 0, n: 1, right: '', close: () => A.render() }).className = 'study m-exam';
  return null;
}

async function startRun(plan, label) {
  const need = [...new Set(plan)];
  const banks = {};
  /* מסך טעינה אמיתי. שליפת הבנק בפעם הראשונה בסשן לוקחת רגע, ובלי
     משוב הכפתור נראה מת. */
  const wait = el('div', 'card'), wm = el('div', 'mid');
  wm.appendChild(el('span', 'eyebrow', 'טוען את הפרק'));
  wm.appendChild(A.skeleton(4));
  wait.appendChild(wm);
  A.openStudy(wait, { i: 0, n: 1, right: '', close: () => A.render() }).className = 'study m-exam';

  let passages = null;
  try {
    for (const k of need) {
      banks[k] = await A.bank(k);
      if (!banks[k] || !banks[k].length) return failed();
    }
    if (plan.includes('rc')) {
      const ps = await A.bank('passage');
      if (!ps || !ps.length) return failed();
      passages = new Map(ps.map((p) => [p.id, p]));
    }
  } catch (e) { return failed(); }
  await scale();

  RUN = { plan, label, banks, passages, s: -1, log: [], recycled: false, sec: null };
  nextSection();
}

function buildSection(kind) {
  const spec = SPEC[kind];
  if (kind !== 'rc') {
    const d = draw(RUN.banks.rs && kind === 'rs' ? RUN.banks.rs : RUN.banks[kind], spec.n);
    RUN.recycled = RUN.recycled || d.recycled;
    return { kind, items: d.items, passage: null };
  }
  /* פרק הבנת הנקרא הוא קטע אחד וחמש שאלות עליו — לא חמש שאלות מקטעים
     שונים. אחרת זה לא פרק אלא ערבוב. */
  const at = ns('attempt');
  const by = new Map();
  RUN.banks.rc.forEach((q) => {
    if (!RUN.passages.has(q.passage)) return;
    if (!by.has(q.passage)) by.set(q.passage, []);
    by.get(q.passage).push(q);
  });
  const usable = [...by.entries()].filter(([, qs]) => qs.length >= spec.n);
  if (!usable.length) return null;
  const unseen = usable.filter(([, qs]) => qs.every((q) => !at[itemId(q)]));
  const from = unseen.length ? unseen : usable;
  RUN.recycled = RUN.recycled || !unseen.length;
  const [pid, qs] = from[(Math.random() * from.length) | 0];
  return { kind, items: qs.slice().sort((a, b) => a.n - b.n).slice(0, spec.n),
           passage: RUN.passages.get(pid) };
}

function nextSection() {
  RUN.s++;
  if (RUN.s >= RUN.plan.length) return finishRun();
  const kind = RUN.plan[RUN.s];
  const built = buildSection(kind);
  if (!built) { toast('אין מספיק פריטים לפרק הזה'); RUN = null; A.render(); return; }
  RUN.sec = Object.assign(built, {
    i: 0, answers: {}, first: {}, left: SPEC[kind].sec, seconds: SPEC[kind].sec,
    ended: false, showText: true, deadline: Date.now() + SPEC[kind].sec * 1000,
  });
  startClock();
  mountSection();
}

/* השעון נבנה מחדש בכל פרק. clearInterval לפני setInterval הוא חובה
   ולא נוחות: שני טיימרים על אותו מונה מורידים אותו פעמיים בשנייה. */
let TIMER = null;
function startClock() {
  clearInterval(TIMER);
  TIMER = setInterval(() => {
    if (!RUN || !RUN.sec || RUN.sec.ended) return clearInterval(TIMER);
    /* לפי שעון אמיתי ולא ספירת תקתוקים: טלפון שמסכו כבה משהה את
       setInterval, והפרק היה מקבל זמן חינם. */
    RUN.sec.left = Math.max(0, Math.ceil((RUN.sec.deadline - Date.now()) / 1000));
    const c = document.querySelector('#clock');
    if (c) {
      c.textContent = fmt(RUN.sec.left);
      c.className = 'clock' + (RUN.sec.left <= 30 ? ' low' : '');
    }
    if (RUN.sec.left <= 0) { clearInterval(TIMER); leave(); closeSection(); }
  }, 1000);
}
function stopClock() { clearInterval(TIMER); TIMER = null; }

/* המעבר הראשון נסגר כשעוזבים את השאלה, לא בלחיצה הראשונה. הגרסה
   הקודמת רשמה את הקליק הראשון, ולכן מי שהתלבט בין שתי אפשרויות באותה
   שאלה נרשם כ"שינה במעבר שני" — וזה בדיוק המדד שאמור לומר לו אם
   חזרה לשאלה עוזרת לו. */
function leave() {
  const S_ = RUN.sec;
  if (!S_) return;
  const it = S_.items[S_.i], id = itemId(it);
  if (id in S_.answers && !(id in S_.first)) S_.first[id] = S_.answers[id];
}

/* ---------- ציור הפרק ----------
   שתי פונקציות ולא אחת, וזו הנקודה: mountSection בונה את הקליפה פעם
   אחת לכל פרק — כותרת, שעון, קטע הקריאה וסרגל הניווט — ו-paintQuestion
   מחליף רק את גוף השאלה.

   הגרסה הקודמת ציירה מחדש את כל הכרטיס בכל הקלקה. המשמעות בטלפון:
   בוחרים תשובה בשאלת הבנת הנקרא, והגלילה קופצת בחזרה לראש הקטע. גם
   הקטע עצמו נבנה מחדש ואיבד את הגלילה הפנימית שלו. זה מה שהפך את
   הפרק למסורבל. */

function mountSection() {
  const S_ = RUN.sec, spec = SPEC[S_.kind];
  const c = el('div', 'card'), mid = el('div', 'mid');

  const bar = el('div', 'secbar');
  bar.innerHTML = '<span class="eyebrow">' + esc(spec.he) +
    (RUN.plan.length > 1 ? ' · פרק ' + (RUN.s + 1) + ' מתוך ' + RUN.plan.length : '') + '</span>' +
    '<span class="clock" id="clock">' + fmt(S_.left) + '</span>';
  mid.appendChild(bar);

  if (S_.passage) {
    const p = el('div', 'passage');
    p.id = 'pass';
    p.innerHTML = A.passageHTML(S_.passage.text);
    mid.appendChild(p);
  }

  const zone = el('div', 'qzone');
  zone.id = 'qzone';
  mid.appendChild(zone);

  /* סרגל הניווט. "הקודם" ו"הבא" הם יעדי מגע מלאים, והמספרים באמצע
     נותנים קפיצה ישירה — ניווט חופשי בתוך הפרק הוא מה שהמבחן מתיר. */
  const acts = el('div', 'acts');
  const navbar = el('div', 'qnav');
  navbar.id = 'qnav';
  acts.appendChild(navbar);

  const fin = el('button', 'btn');
  fin.id = 'finbtn';
  fin.onclick = () => {
    leave();
    const blank = S_.items.filter((x) => !(itemId(x) in S_.answers)).length;
    if (blank && !confirm(A.plural(blank, 'שאלה אחת ריקה', 'שאלות ריקות') +
      '. אין קנס על טעות והוראת המבחן היא לנחש. לסגור בכל זאת?')) return;
    closeSection();
  };
  acts.appendChild(fin);

  c.append(mid, acts);
  const box = A.openStudy(c, { i: S_.i, n: S_.items.length, right: '', close: quit });
  box.className = 'study m-' + spec.mode;
  paintQuestion();
}

function paintQuestion() {
  const S_ = RUN.sec;
  if (!S_) return;
  const it = S_.items[S_.i], id = itemId(it);
  const zone = document.querySelector('#qzone');
  if (!zone) return mountSection();

  zone.innerHTML = '';
  const stem = el('div', 'ex');
  if (S_.kind === 'sc') stem.style.fontSize = 'var(--fs-en-md)';
  stem.innerHTML = S_.kind === 'sc' ? A.examSentence(it.stem) : esc(it.stem);
  zone.appendChild(stem);

  const box = el('div', 'opts');
  it.options.forEach((o, k) => {
    const b = el('button', 'opt' + (S_.answers[id] === k ? ' pick' : ''),
      '<span class="num">(' + (k + 1) + ')</span>' + esc(o));
    b.onclick = () => choose(k);
    box.appendChild(b);
  });
  zone.appendChild(box);
  paintNav();
}

/* בחירה לא מציירת מחדש: היא מחליפה מחלקה על ארבעה כפתורים ומתקדמת.
   ההשהיה קצרה בכוונה — מספיק כדי לראות שהבחירה נקלטה, לא מספיק כדי
   להרגיש המתנה. */
function choose(k) {
  const S_ = RUN.sec;
  if (!S_ || S_.ended) return;
  const id = itemId(S_.items[S_.i]);
  S_.answers[id] = k;
  A.buzz(10);
  const opts = document.querySelectorAll('#qzone .opt');
  opts.forEach((b, i) => b.classList.toggle('pick', i === k));
  paintNav();

  clearTimeout(S_._adv);
  const nextUnanswered = S_.items.findIndex((x, i) => i > S_.i && !(itemId(x) in S_.answers));
  if (nextUnanswered > -1) {
    S_._adv = setTimeout(() => {
      if (!RUN || RUN.sec !== S_ || S_.ended) return;
      goTo(nextUnanswered);
    }, 280);
  }
}

function goTo(i) {
  const S_ = RUN.sec;
  if (!S_ || i === S_.i) return;
  clearTimeout(S_._adv);
  leave();
  S_.i = i;
  paintQuestion();
  /* הגלילה נשארת איפה שהיא. בהבנת הנקרא זה בדיוק הרצוי — הקטע למעלה
     והשאלה החדשה בדיוק במקום שבו הייתה הקודמת. */
}

function paintNav() {
  const S_ = RUN.sec;
  const nav = document.querySelector('#qnav');
  const fin = document.querySelector('#finbtn');
  if (!nav || !S_) return;
  const n = S_.items.length;
  const answeredAll = S_.items.every((x) => itemId(x) in S_.answers);
  const blank = S_.items.filter((x) => !(itemId(x) in S_.answers)).length;

  nav.innerHTML = '';
  /* משולשים ולא גרשיים זוויתיים: ‹ ו-› הם תווים ניטרליים שהאלגוריתם
     הדו-כיווני הופך, כלומר הקוד אמר דבר אחד והמסך הראה את ההפך.
     ▸ ו-◂ אינם מתהפכים, ולכן מה שכתוב הוא מה שנראה. בעברית "אחורה"
     הוא ימינה. */
  const prev = el('button', 'qarrow', '▸');
  prev.setAttribute('aria-label', 'השאלה הקודמת');
  prev.disabled = S_.i === 0;
  prev.onclick = () => goTo(S_.i - 1);

  const dots = el('div', 'qdots');
  S_.items.forEach((x, k) => {
    const done = itemId(x) in S_.answers;
    const b = el('button', 'qdot' + (k === S_.i ? ' on' : '') + (done ? ' done' : ''), String(k + 1));
    b.setAttribute('aria-label', 'שאלה ' + (k + 1) + (done ? ', נענתה' : ', ריקה'));
    b.onclick = () => goTo(k);
    dots.appendChild(b);
  });

  const next = el('button', 'qarrow', '◂');
  next.setAttribute('aria-label', 'השאלה הבאה');
  next.disabled = S_.i === n - 1;
  next.onclick = () => goTo(S_.i + 1);

  nav.append(prev, dots, next);

  fin.className = 'btn' + (answeredAll ? '' : ' ghost');
  fin.textContent = answeredAll ? 'סגור פרק'
    : 'סגור פרק · ' + A.plural(blank, 'אחת ריקה', 'ריקות');
}

function quit() {
  stopClock();
  RUN = null;
  A.render();
}

/* ---------- סגירת פרק ----------
   אין חזרה. זה לא קפדנות לשמה — זה התנאי במבחן, והוא משנה איך
   מחלקים את הזמן בתוך הפרק. */
function closeSection() {
  const S_ = RUN.sec;
  if (S_.ended) return;
  S_.ended = true; stopClock();
  let ok = 0, blank = 0, cg = 0, cb = 0;
  S_.items.forEach((it) => {
    const id = itemId(it), a = S_.answers[id], f = S_.first[id];
    if (a == null) { blank++; return; }
    const right = a === it.answer;
    if (right) ok++;
    if (f != null && f !== a) (right ? cg++ : cb++);
    put('attempt', id, { c: a, ok: right ? 1 : 0, pass: f === a ? 1 : 2, at: Date.now() });
    bump({ ex: 1, exok: right ? 1 : 0 });
  });
  RUN.log.push({ kind: S_.kind, ok, n: S_.items.length, blank, cg, cb,
                 used: S_.seconds - S_.left, items: S_.items, answers: S_.answers,
                 passage: S_.passage });
  RUN.plan.length > 1 ? interSection() : finishRun();
}

/* ---------- בין פרקים ---------- */
function interSection() {
  const last = RUN.log[RUN.log.length - 1];
  const c = el('div', 'card'), mid = el('div', 'mid');
  const left = RUN.plan.length - RUN.log.length;
  mid.innerHTML =
    '<span class="eyebrow">פרק ' + RUN.log.length + ' נסגר</span>' +
    '<div class="big">' + last.ok + '/' + last.n + '</div>' +
    '<div class="note" style="text-align:center;max-width:42ch">' +
      esc(SPEC[last.kind].he) + ' · ' + fmt(last.used) + ' מתוך ' + fmt(SPEC[last.kind].sec) +
      (last.blank ? ' · <b style="color:var(--bad)">' + last.blank + ' ריקות</b>' : '') +
      '<br>הפרק סגור ואין אליו חזרה, בדיוק כמו במבחן.' +
      (left ? '<br><b>' + left + '</b> פרקים לפניך.' : '') + '</div>';
  const acts = el('div', 'acts');
  const go = el('button', 'btn', left ? 'הפרק הבא — ' + SPEC[RUN.plan[RUN.s + 1]].he : 'סיכום');
  go.onclick = nextSection;
  const stop = el('button', 'btn ghost sm', 'עצור כאן');
  stop.onclick = finishRun;
  acts.append(go, stop);
  c.append(mid, acts);
  A.openStudy(c, { i: RUN.log.length, n: RUN.plan.length, right: '', close: quit })
    .className = 'study m-' + SPEC[last.kind].mode;
}

/* ---------- סיכום ---------- */
function finishRun() {
  stopClock();
  const log = RUN.log;
  if (!log.length) return quit();

  let num = 0, den = 0, ok = 0, n = 0, blank = 0, cg = 0, cb = 0, used = 0;
  const by = {};
  log.forEach((s) => {
    ok += s.ok; n += s.n; blank += s.blank; cg += s.cg; cb += s.cb; used += s.used;
    (by[s.kind] = by[s.kind] || [0, 0])[0] += s.ok;
    by[s.kind][1] += s.n;
  });
  Object.keys(by).forEach((k) => { num += by[k][0] / by[k][1] * SPEC[k].weight; den += SPEC[k].weight; });
  const acc = den ? num / den : 0;
  const est = SCALE ? SCALE[Math.max(0, Math.min(44, Math.round(acc * 44)))] : null;

  const c = el('div', 'card'), mid = el('div', 'mid');
  let h = '<span class="eyebrow">' + esc(RUN.label) + '</span>' +
    '<div class="big">' + ok + '/' + n + '</div>';
  if (est) h += '<div class="note" style="text-align:center">קצב של <b>' + est +
    '</b> בסולם <span class="rng">50–150</span>' +
    (den < 23 ? ' — משוקלל על הפרקים שעשית בלבד' : '') + '</div>';
  h += '<div class="note" style="text-align:center">' + fmt(used) + ' זמן בפועל</div>';
  mid.innerHTML = h;

  if (blank) mid.appendChild(el('div', 'note',
    '<b style="color:var(--bad)">' + A.plural(blank, 'שאלה אחת נשארה ריקה', 'שאלות נשארו ריקות') + '.</b> ' +
    'אין קנס על טעות וההוראה הרשמית היא לנחש — בתוחלת ויתרת על ' +
    (Math.round(blank * 0.25 * 10) / 10) + ' תשובות נכונות.'));
  if (cg || cb) mid.appendChild(el('div', 'note',
    'שינית ' + A.plural(cg + cb, 'תשובה אחת', 'תשובות') + ' אחרי המעבר הראשון: <b>' + cg + '</b> לטובה, <b>' + cb + '</b> לרעה.' +
    (cg + cb >= 4 ? (cg > cb ? ' השינוי עובד לך.' : cb > cg ? ' התחושה הראשונה שלך טובה יותר.' : '') : '')));

  const grid = el('div', 'statgrid');
  Object.keys(by).forEach((k) => {
    grid.innerHTML += '<div class="stat"><div class="v">' +
      Math.round(100 * by[k][0] / by[k][1]) + '%</div>' +
      '<div class="l">' + esc(SPEC[k].he) + '</div>' +
      '<div class="s">' + by[k][0] + '/' + by[k][1] + ' · ' +
      Math.round(100 * SPEC[k].weight / TOTALQ) + '% מהציון</div></div>';
  });
  mid.appendChild(grid);

  /* פירוט לכל שאלה שנפלה, עם ההסבר המלא */
  const wrong = [];
  log.forEach((s) => s.items.forEach((it) => {
    const a = s.answers[itemId(it)];
    if (a !== it.answer) wrong.push({ it, a, passage: s.passage });
  }));
  if (wrong.length) {
    const sec = el('div', 'sec');
    sec.appendChild(el('span', 'eyebrow', 'מה שנפל · ' + wrong.length));
    wrong.forEach(({ it, a }) => {
      const b = el('div', 'sec');
      b.appendChild(el('div', 'ex', it.kind === 'sc' ? A.examSentence(it.stem) : esc(it.stem)));
      b.appendChild(explain(it, a));
      sec.appendChild(b);
    });
    mid.appendChild(sec);
  }

  const acts = el('div', 'acts');
  const again = el('button', 'btn', RUN.plan.length > 1 ? 'עוד סימולציה' : 'פרק נוסף');
  const plan = RUN.plan, label = RUN.label;
  again.onclick = () => { RUN = null; A.closeStudy(); startRun(plan, label); };
  const out = el('button', 'btn ghost sm', 'חזרה');
  out.onclick = () => { RUN = null; A.closeStudy(); A.render(); };
  acts.append(again, out);
  c.append(mid, acts);
  A.openStudy(c, { i: 1, n: 1, right: '', close: quit }).className = 'study m-exam';
  RUN.sec = null;
}

/* ---------- הסבר לשאלה שנפלה ---------- */
function explain(it, chosen) {
  const w = el('div', 'why');
  let h = '<h4>התשובה: (' + (it.answer + 1) + ')' +
    (chosen == null ? ' — נשארה ריקה' : ' · בחרת (' + (chosen + 1) + ')') + '</h4>';
  if (it.kind === 'sc' && it.full) {
    h += '<div class="ex">' + A.highlightWord(it.full, it.options[it.answer]) + '</div>';
  }
  it.options.forEach((o, k) => {
    const cls = k === it.answer ? 'ok' : k === chosen ? 'no' : 'dim';
    const mk = k === it.answer ? '✓' : k === chosen ? '✗' : '·';
    const g = it.kind === 'sc' ? gloss(o) : '';
    h += '<div class="opt-row ' + cls + '"><div class="mk">' + mk + '</div><div>' +
      '<div class="en">' + esc(o) + '</div>' + g + '</div></div>';
  });
  const tip = window.AMStrat && window.AMStrat.ruleFor(it);
  if (tip) h += '<div class="note" style="margin-top:8px">' + tip + '</div>';
  w.innerHTML = h;

  /* קישור לדף המילה מכל אפשרות. שם יושב מה שאין כאן: איפה המילה
     הופיעה במבחנים אחרים, האסוציאציה, ומתי היא חוזרת. */
  if (it.kind === 'sc' && window.AMWords) {
    Array.from(w.querySelectorAll('.opt-row')).forEach((row, k) => {
      const en = row.querySelector('.en');
      if (!en || !S.words.has(String(it.options[k]).toLowerCase().trim())) return;
      en.classList.add('lnk');
      en.setAttribute('role', 'button');
      en.setAttribute('tabindex', '0');
      const open = () => window.AMWords.open(String(it.options[k]).toLowerCase().trim());
      en.onclick = open;
      en.onkeydown = (e) => { if (e.key === 'Enter') open(); };
    });
  }
  return w;
}
function gloss(word) {
  const o = S.words.get(String(word).toLowerCase().trim());
  if (!o || !(o.def || o.he)) return '<div class="gl dim">—</div>';
  return '<div class="gl">' + (o.def ? esc(o.def) : '') +
    (o.he ? ' — <b>' + esc(o.he) + '</b>' : '') + '</div>';
}

/* ============================================================
   המסך
   ============================================================ */
async function view(v) {
  const signed = !!(window.Cloud && window.Cloud.user);
  A.head(v, 'תרגול', 'שאלות אמיתיות ממבחני עבר, עם התשובות הרשמיות.');

  if (!signed) {
    v.appendChild(A.state('צריך להתחבר',
      'בנק השאלות יושב מאחורי התחברות, כי חוברות הבחינה אסורות בהפצה. ' +
      'הלומדה והמשחקים עובדים גם בלי חשבון.',
      { label: 'התחברות עם Google', fn: () => window.Cloud && window.Cloud.login && window.Cloud.login() }));
    return;
  }

  const D = window.AMDrills, St = window.AMStrat;
  const g1 = el('div', 'sec list');
  g1.appendChild(el('span', 'eyebrow', 'בפורמט המבחן'));
  A.tile(g1, 'סימולציה מלאה', 'שישה פרקים · 23 שאלות · 32:30 · ציון משוער',
    () => startRun(SIM.slice(), 'סימולציה מלאה'));
  A.tile(g1, 'רצף פרקים', 'פרק אחרי פרק בסדר מעורב, עוצרים מתי שרוצים',
    () => startRun(shuffle(['sc', 'rs', 'rc', 'sc', 'rs', 'sc', 'rc', 'sc', 'rs', 'sc']), 'רצף פרקים'));
  const badges = {};
  Object.keys(SPEC).forEach((k) => {
    const t = A.tile(g1, SPEC[k].he, SPEC[k].n + ' שאלות · ' + fmt(SPEC[k].sec) + ' · ' +
      Math.round(100 * SPEC[k].weight / TOTALQ) + '% מהציון', () => startRun([k], 'פרק ' + SPEC[k].he));
    badges[k] = t.querySelector('.ts');
  });
  v.appendChild(g1);

  const g2 = el('div', 'sec list');
  g2.appendChild(el('span', 'eyebrow', 'אימון ממוקד'));
  if (St) A.tile(g2, 'דריל פסילה · השלמת משפטים', 'לפסול לפני שבוחרים — הליבה של 52% מהציון', () => St.elim('sc', 8));
  if (St) A.tile(g2, 'דריל פסילה · ניסוח מחדש', 'שני כללים נמדדים שחותכים אפשרות לפני הקריאה', () => St.elim('rs', 6));
  if (St) A.tile(g2, 'קריאה ממוקדת', 'שאלה קודם, ואז רק הפסקה שהיא מציינת', St.focus);
  if (D) A.tile(g2, 'צייד המלכודות', 'ניסוח מחדש: לבחור, ואז לתייג למה השאר שגויים', D.traps);
  if (D) A.tile(g2, 'מסגרות מגלות', 'הגדרה בתוך המשפט, או ניגוד', D.frames);
  if (D) A.tile(g2, 'ספרינט מטרת הפסקה', '20% משאלות הבנת הנקרא', () => D.rc('sprint'));
  if (D) A.tile(g2, 'קטע מלא', 'קטע אמיתי וחמש שאלות בסדר המבחן', () => D.rc('full'));
  v.appendChild(g2);

  const g3 = el('div', 'sec list');
  g3.appendChild(el('span', 'eyebrow', 'מעקב'));
  A.tile(g3, 'בנק הטעויות', 'שאלות שטעית בהן ועוד לא סגרת', () => A.go('fix'));
  A.tile(g3, 'התקדמות', 'אומדן ציון מול 134, מגמה ודיוק לפי פרק', () => A.go('prog'));
  v.appendChild(g3);

  v.appendChild(el('p', 'note',
    'לשבועיים האחרונים: שלוש הסימולציות הרשמיות של מאל"ו, כולל האדפטיביות — ' +
    '<a href="https://amirnet-practice.nite.org.il/amirnet.html" target="_blank" rel="noopener">amirnet-practice.nite.org.il</a>'));

  /* כמה נשאר במאגר — נטען אחרי הציור, ומתווסף לשורות שכבר על המסך */
  try {
    const ps = await A.bank('passage');
    const pmap = ps ? new Map(ps.map((p) => [p.id, p])) : null;
    for (const k of Object.keys(SPEC)) {
      const rows = await A.bank(k);
      if (!rows || !badges[k]) continue;
      const c = coverage(rows, k, pmap);
      badges[k].textContent += ' · נשארו ' + (c.sections - c.done) + ' מתוך ' + c.sections;
    }
  } catch (e) { /* הספירה היא תוספת; בלעדיה המסך שלם */ }
}

window.AMExam = { view, run: startRun, SPEC, SIM };

})();
