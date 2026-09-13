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
const { el, esc, shuffle, toast, ns, put, pref, setPref, bump, S } = A;

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
          ? 'בנק השאלות לא הגיע מהמסד. זה לא אובדן נתונים — ההתקדמות שלך שמורה מקומית.<br>נסה שוב, ואם זה חוזר בדוק את חיבור החשבון תחת <b>עוד</b>.'
          : 'אין רשת. אוצר המילים, התזמון וההדפסה עובדים אופליין; פרקי אמת דורשים חיבור.')
      : 'בנק השאלות יושב מאחורי התחברות — חוברות מאל"ו נושאות איסור הפצה. ' +
        'הכפתור למעלה מימין.',
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
    ended: false, showText: true,
  });
  startClock();
  paint();
}

/* השעון נבנה מחדש בכל פרק. clearInterval לפני setInterval הוא חובה
   ולא נוחות: שני טיימרים על אותו מונה מורידים אותו פעמיים בשנייה. */
let TIMER = null;
function startClock() {
  clearInterval(TIMER);
  TIMER = setInterval(() => {
    if (!RUN || !RUN.sec || RUN.sec.ended) return clearInterval(TIMER);
    RUN.sec.left--;
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

function paint() {
  const S_ = RUN.sec, spec = SPEC[S_.kind];
  const it = S_.items[S_.i], id = itemId(it);
  const c = el('div', 'card'), mid = el('div', 'mid');

  mid.innerHTML =
    '<div class="secbar"><span class="eyebrow">' + esc(spec.he) +
      (RUN.plan.length > 1 ? ' · פרק ' + (RUN.s + 1) + ' מתוך ' + RUN.plan.length : '') + '</span>' +
    '<span class="clock" id="clock">' + fmt(S_.left) + '</span></div>';

  if (S_.passage) {
    const p = el('div', 'passage' + (S_.showText ? '' : ' folded'));
    p.innerHTML = S_.passage.text.split(/\n{2,}/)
      .map((t) => '<p>' + esc(t.trim()) + '</p>').join('');
    mid.appendChild(p);
  }

  const stem = el('div', 'ex');
  stem.style.fontSize = S_.kind === 'sc' ? 'var(--fs-lg)' : 'var(--fs-md)';
  stem.innerHTML = S_.kind === 'sc' ? A.examSentence(it.stem) : esc(it.stem);
  mid.appendChild(stem);

  const box = el('div', 'opts');
  it.options.forEach((o, k) => {
    const b = el('button', 'opt' + (S_.answers[id] === k ? ' pick' : ''),
      '<span class="num">(' + (k + 1) + ')</span>' + esc(o));
    b.onclick = () => {
      S_.answers[id] = k;
      A.buzz(10);
      paint();
    };
    box.appendChild(b);
  });
  mid.appendChild(box);

  /* ניווט חופשי בתוך הפרק — בדיוק מה שהמבחן מתיר, ומה שצריך לאמן. */
  const acts = el('div', 'acts');
  const pager = el('div', 'grades');
  pager.style.gridTemplateColumns = 'repeat(' + S_.items.length + ',1fr)';
  S_.items.forEach((x, k) => {
    const answered = itemId(x) in S_.answers;
    const b = el('button', 'grade' + (k === S_.i ? ' g3' : ''),
      (k + 1) + (answered ? '<small>✓</small>' : '<small>—</small>'));
    b.onclick = () => { leave(); S_.i = k; paint(); };
    pager.appendChild(b);
  });
  const blank = S_.items.filter((x) => !(itemId(x) in S_.answers)).length;
  const fin = el('button', 'btn' + (blank ? ' ghost' : ''),
    blank ? 'סגור פרק · ' + blank + ' ריקות' : 'סגור פרק');
  fin.onclick = () => {
    leave();
    if (blank && !confirm(blank + ' שאלות ריקות. אין קנס על טעות והוראת המבחן היא לנחש. לסגור בכל זאת?')) return;
    closeSection();
  };
  acts.append(pager, fin);
  c.append(mid, acts);

  const box2 = A.openStudy(c, { i: S_.i, n: S_.items.length, right: '', close: quit });
  box2.className = 'study m-' + spec.mode;
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
    '<b style="color:var(--bad)">' + blank + ' שאלות נשארו ריקות.</b> ' +
    'אין קנס על טעות וההוראה הרשמית היא לנחש — בתוחלת ויתרת על ' +
    (Math.round(blank * 0.25 * 10) / 10) + ' תשובות נכונות.'));
  if (cg || cb) mid.appendChild(el('div', 'note',
    'שינית ' + (cg + cb) + ' תשובות אחרי המעבר הראשון: <b>' + cg + '</b> לטובה, <b>' + cb + '</b> לרעה.' +
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
  const head = el('div', 'sec');
  head.appendChild(el('span', 'eyebrow', 'פרקי אמת'));
  head.appendChild(el('p', 'note',
    'פרק אחרי פרק, בפורמט המבחן: ניווט חופשי בתוך הפרק, שעון לכל פרק, ' +
    'ואין חזרה אחרי סגירה. פריט שכבר ראית לא יחזור עד שהמאגר ייגמר.'));
  v.appendChild(head);
  if (!signed) {
    v.appendChild(el('div', 'note', 'בנק השאלות דורש התחברות — הכפתור למעלה מימין.'));
    return;
  }

  const t = (title, sub, fn, badge) => {
    const b = el('button', 'btn ghost');
    b.style.cssText = 'text-align:right;padding:14px';
    b.innerHTML = '<div style="font-weight:700;font-size:var(--fs-md);color:var(--text)">' + esc(title) +
      (badge ? ' <span class="pill good">' + esc(badge) + '</span>' : '') + '</div>' +
      '<div class="tiny muted" style="font-weight:400;margin-top:2px">' + esc(sub) + '</div>';
    b.onclick = fn;
    v.appendChild(b);
  };

  t('סימולציה מלאה', 'שישה פרקים בסדר המבחן · 23 שאלות · 32:30. ציון משוער בסוף.',
    () => startRun(SIM.slice(), 'סימולציה מלאה'), 'הפורמט המלא');
  t('רצף פרקים', 'פרק אחרי פרק בלי הפסקה, בסדר מעורב. עוצרים מתי שרוצים.',
    () => startRun(shuffle(['sc', 'rs', 'rc', 'sc', 'rs', 'sc', 'rc', 'sc', 'rs', 'sc']), 'רצף פרקים'));
  Object.keys(SPEC).forEach((k) => {
    t('פרק ' + SPEC[k].he, SPEC[k].n + ' שאלות · ' + fmt(SPEC[k].sec) + ' · ' +
      Math.round(100 * SPEC[k].weight / TOTALQ) + '% מהציון',
      () => startRun([k], 'פרק ' + SPEC[k].he));
  });

  /* כמה נשאר במאגר */
  const cov = el('div', 'sec');
  cov.appendChild(el('span', 'eyebrow', 'כמה פרקים נשארו לך'));
  const grid = el('div', 'statgrid');
  const pmap = await (async () => {
    const ps = await A.bank('passage');
    return ps ? new Map(ps.map((p) => [p.id, p])) : null;
  })();
  for (const k of Object.keys(SPEC)) {
    const rows = await A.bank(k);
    if (!rows) continue;
    const c = coverage(rows, k, pmap);
    grid.innerHTML += '<div class="stat"><div class="v">' + (c.sections - c.done) + '</div>' +
      '<div class="l">' + esc(SPEC[k].he) + '</div>' +
      '<div class="s">מתוך ' + c.sections + ' · ' + c.seen + '/' + c.total + ' שאלות נראו</div></div>';
  }
  cov.appendChild(grid);
  cov.appendChild(el('p', 'note',
    'המאגר מחזיק <b>116</b> פרקי השלמת משפטים, <b>77</b> ניסוח מחדש ו-<b>108</b> קטעי קריאה — ' +
    'ומהם <b>38 סימולציות מלאות</b> בלי שפריט אחד יחזור.'));
  v.appendChild(cov);

  t('תרגולים ממוקדים', 'מסגרות מגלות · צייד המלכודות · ספרינט מטרת הפסקה.',
    () => A.go('focus'));

  const note = el('div', 'sec');
  note.appendChild(el('span', 'eyebrow', 'שתי הערות על נאמנות'));
  note.appendChild(el('p', 'note',
    '<b>השעון.</b> מאל"ו לא מפרסמת זמן לכל פרק, רק 39 דקות לכלל המבחן על <span class="rng">7–8</span> פרקים ' +
    'שמתוכם <span class="rng">1–2</span> ניסוייים. ההקצבה כאן נגזרה מעומס הקריאה שמדדתי — <span class="rng">1:24</span> לשאלה כבסיס, ' +
    'מותאם לכל סוג פרק — וסך הסימולציה 32:30, בדיוק היחס של 23 השאלות הנספרות.<br><br>' +
    '<b>האדפטיביות.</b> המבחן אדפטיבי ברמת הפרק והסימולציה כאן לא מדמה את זה. חיפשתי ' +
    'דירוג קושי בפריטים — מיקום בפרק מול נדירות מילת התשובה נתן r=-0.36 על שמונה נקודות ' +
    'רועשות, ומול אורך המילה r=-0.18. אין שם אות, ולדמות אדפטיביות על דירוג שהמצאתי ' +
    'היה מייצר ציון שנשמע מדויק ואינו.'));
  v.appendChild(note);

  const sim = el('div', 'sec');
  sim.appendChild(el('span', 'eyebrow', 'הסימולציות הרשמיות'));
  sim.appendChild(el('div', 'note',
    'למאל"ו שלוש סימולציות חינם בפורמט אמירנט המלא, כולל האדפטיביות האמיתית. ' +
    'שמור אותן לשבועיים האחרונים — הן הדבר היחיד שמאמן את התנאים עצמם.<br>' +
    '<a href="https://amirnet-practice.nite.org.il/amirnet.html" target="_blank" rel="noopener" ' +
    'style="color:var(--accent)">amirnet-practice.nite.org.il</a>'));
  v.appendChild(sim);
}

window.AMExam = { view, run: startRun, SPEC, SIM };

})();
