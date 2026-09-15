/* ================= אמירנט — משימת היום ובנק הטעויות =================

   שני מסכים שנולדו מאותה תלונה: "הסידור". רשימת כפתורים לא אומרת מה
   לעשות עכשיו, ומערכת שלא זוכרת על מה טעית נותנת לטעות לחזור עשר פעמים
   בשקט.

   מסך הבית לא מציע רשימה — הוא מחליט: הלומדה, ועד שלוש משימות
   שנבחרו לפי מה שהכי חסר.
   ============================================================== */
'use strict';

(function () {

const A = window.AM;
const { el, esc, toast, ns, put, pref, card, S, today, between, isOff } = A;

/* ---------- דיוק לפי סוג פרק ----------
   רק ניסיונות אמיתיים על פריטי מבחן. פחות משמונה ניסיונות זה רעש ולא
   מדידה, ולכן פרק כזה לא מוצג כחולשה. */
const KIND = {
  sc: { he: 'השלמת משפטים', weight: 12, mode: 'exam' },
  rs: { he: 'ניסוח מחדש',   weight: 6,  mode: 'trap' },
  rc: { he: 'הבנת הנקרא',   weight: 5,  mode: 'read' },
};
const TOTALQ = 23;

function accuracy() {
  const out = {};
  for (const k in KIND) out[k] = { n: 0, ok: 0 };
  const at = ns('attempt');
  for (const id in at) {
    const k = id.split(':')[0];
    if (!out[k] || at[id].ok == null) continue;
    out[k].n++; out[k].ok += at[id].ok ? 1 : 0;
  }
  for (const k in out) out[k].pct = out[k].n ? Math.round(100 * out[k].ok / out[k].n) : null;
  return out;
}

/* ---------- בנק הטעויות ----------
   פריט נכנס כשטעו בו, ויוצא רק בסימון "הבנתי" — לא בתשובה נכונה אחת.
   תשובה נכונה בחזרה היא ראיה, לא הוכחה, ולכן היא נספרת ומוצגת ולא
   מוחקת. */
const MISTAKES = () => {
  const at = ns('attempt'), out = [];
  for (const id in at) {
    const a = at[id];
    if (a.ok !== 0 || a.fixed) continue;
    if (id.indexOf(':trap') > -1) continue;
    out.push({ id, kind: id.split(':')[0], at: a.at || 0, tries: a.tries || 1, back: a.back || 0 });
  }
  return out.sort((x, y) => y.at - x.at);
};
const stuckWords = () => {
  const cs = ns('cards'), out = [];
  for (const w in cs) if ((cs[w].af || 0) >= 2 || (cs[w].l || 0) >= 3) out.push(w);
  return out.sort((a, b) => ((cs[b].af || 0) + (cs[b].l || 0)) - ((cs[a].af || 0) + (cs[a].l || 0)));
};

/* ============================================================
   הבית
   ============================================================
   שלושה דברים, לא יותר: מי אתה ומתי המבחן, הלומדה, ועד שלוש
   משימות תרגול שנבחרו לפי מה שהכי חסר עכשיו. */

function greeting() {
  const h = new Date().getHours();
  const hi = h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : h < 21 ? 'ערב טוב' : 'לילה טוב';
  const C = window.Cloud;
  const name = C && C.user && C.user.firstName;
  return hi + (name ? ', ' + name : '');
}

function home(v) {
  const left = between(today(), S.exam);
  const t = today();
  const rounds = A.day().rounds || 0;
  const sub = left < 0 ? 'המבחן מאחוריך'
    : left === 0 ? 'היום המבחן. בהצלחה!'
    : isOff(t) ? 'שבת או חג — סבב קצר אחד מספיק היום'
    : rounds >= 4 ? 'עברת את היעד היומי. כל סבב נוסף הוא בונוס.'
    : rounds ? 'עשית ' + A.plural(rounds, 'סבב אחד', 'סבבים') + ' היום. היעד: 4.'
    : 'היעד להיום: 4 סבבים קצרים.';
  A.head(v, greeting(), sub);

  if (window.AMLomda) window.AMLomda.homeCard(v);

  const acc = accuracy(), mist = MISTAKES();
  const M = [];
  const weak = Object.keys(KIND).filter((k) => acc[k].n >= 8)
    .sort((a, b) => acc[a].pct - acc[b].pct)[0];
  if (mist.length >= 3) M.push(['בנק הטעויות', A.plural(mist.length, 'שאלה אחת פתוחה', 'שאלות פתוחות') + ' — לסגור לפני שהן חוזרות במבחן', () => A.go('fix')]);
  if (weak && acc[weak].pct < 80) M.push(['חיזוק: ' + KIND[weak].he, 'הדיוק שלך ' + acc[weak].pct + '% · ' +
    Math.round(100 * KIND[weak].weight / TOTALQ) + '% מהציון', () => window.AMExam.run([weak], 'פרק ' + KIND[weak].he)]);
  M.push(['פרק אמת', 'שאלות ממבחני עבר בפורמט המבחן, עם שעון', () => A.go('drill')]);
  const E = pref('elim', {});
  if (!E.n) M.push(['דריל פסילה', 'לפסול שתיים מארבע שווה 75% — חמש דקות', () => window.AMStrat.elim('sc', 8)]);

  const sec = el('div', 'sec list');
  sec.appendChild(el('span', 'eyebrow', 'להמשך היום'));
  M.slice(0, 3).forEach(([title, why, fn]) => A.tile(sec, title, why, fn));
  v.appendChild(sec);
}

/* ============================================================
   בנק הטעויות
   ============================================================ */

let FIX = null;

async function resolve(ids) {
  /* שליפת שורות הבנק לפי המזהים. הבנק כבר במטמון הסשן אחרי דריל אחד,
     ולכן זה בדרך כלל לא נוגע ברשת. */
  const kinds = [...new Set(ids.map((i) => i.split(':')[0]))];
  const rows = {};
  for (const k of kinds) {
    const r = await A.bank(k);
    (r || []).forEach((x) => { rows[window.AMDrills.itemId(x)] = x; });
  }
  return ids.map((i) => rows[i]).filter(Boolean);
}

async function startFix() {
  const ids = MISTAKES().map((m) => m.id);
  if (!ids.length) { toast('אין טעויות פתוחות'); return; }
  const items = await resolve(ids.slice(0, 10));
  if (!items.length) { toast('בנק השאלות לא נטען — התחבר קודם'); return; }
  const need = items.filter((x) => x.kind === 'rc').length;
  FIX = { items, i: 0, n: 0, hit: 0, pick: null, ps: null };
  if (need) {
    const ps = await A.bank('passage');
    FIX.ps = new Map((ps || []).map((p) => [p.id, p]));
  }
  paintFix();
}

function paintFix() {
  const it = FIX.items[FIX.i], id = window.AMDrills.itemId(it);
  const done = FIX.pick != null;
  const prev = ns('attempt')[id] || {};
  const c = el('div', 'card'), mid = el('div', 'mid');
  mid.innerHTML =
    '<span class="eyebrow">בנק הטעויות · ' + (FIX.i + 1) + ' מתוך ' + FIX.items.length + '</span>' +
    (prev.back ? '<div class="tiny dim">חזרת לשאלה הזו ' + A.plural(prev.back, 'פעם אחת', 'פעמים') + '</div>' : '');

  if (it.kind === 'rc' && FIX.ps && FIX.ps.get(it.passage)) {
    const p = el('div', 'passage');
    p.innerHTML = A.passageHTML(FIX.ps.get(it.passage).text);
    mid.appendChild(p);
  }
  const stem = el('div', 'ex');
  stem.style.fontSize = 'var(--fs-md)';
  stem.innerHTML = it.kind === 'sc' ? A.examSentence(it.stem) : esc(it.stem);
  mid.appendChild(stem);

  const box = el('div', 'opts');
  it.options.forEach((o, k) => {
    let cls = 'opt';
    if (done) {
      if (k === it.answer) cls += ' right';
      else if (k === FIX.pick) cls += ' wrong';
      if (k === prev.c && k !== it.answer) cls += ' oldpick';
    }
    const b = el('button', cls, '<span class="num">(' + (k + 1) + ')</span>' + esc(o));
    if (done) b.disabled = true;
    else b.onclick = () => answerFix(k);
    box.appendChild(b);
  });
  mid.appendChild(box);

  if (done) {
    const w = el('div', 'why');
    const right = FIX.pick === it.answer;
    let h = '<h4>' + (right ? 'הפעם נכון' : 'עדיין לא') + '</h4>';
    if (prev.c != null && prev.c !== it.answer) {
      h += '<p class="note">בפעם הקודמת בחרת <b>(' + (prev.c + 1) + ')</b>' +
        (FIX.pick === prev.c ? ' — ובחרת בה שוב. זו לא טעות אקראית אלא הבנה שגויה שחוזרת.'
                             : '.') + '</p>';
    }
    if (it.kind === 'sc' && it.full) {
      h += '<h4>המשפט השלם</h4><div class="ex">' + A.highlightWord(it.full, it.options[it.answer]) + '</div>';
    }
    h += '<h4>ארבע האפשרויות</h4>';
    it.options.forEach((o, k) => {
      const g = it.kind === 'sc' ? glossOf(o) : '';
      h += '<div class="opt-row ' + (k === it.answer ? 'ok' : 'no') + '">' +
        '<div class="mk">' + (k === it.answer ? '✓' : '·') + '</div><div>' +
        '<div class="en">' + esc(o) + '</div>' + g + '</div></div>';
    });
    w.innerHTML = h;
    mid.appendChild(w);
  }

  const acts = el('div', 'acts');
  if (done) {
    const ok = el('button', 'btn', 'הבנתי — הוצא מהבנק');
    ok.onclick = () => { markFixed(id); step(); };
    const later = el('button', 'btn ghost', 'השאר בבנק');
    later.onclick = step;
    acts.append(ok, later);
  }
  c.append(mid, acts);
  const b = A.openStudy(c, { i: FIX.i, n: FIX.items.length, right: FIX.hit + '/' + FIX.n,
    close: () => { FIX = null; A.render(); } });
  b.className = 'study m-trap';
}

function glossOf(word) {
  const o = S.words.get(String(word).toLowerCase().trim());
  if (!o || !(o.def || o.he)) return '<div class="gl dim">—</div>';
  return '<div class="gl">' + (o.def ? esc(o.def) : '') +
    (o.he ? ' — <b>' + esc(o.he) + '</b>' : '') + '</div>';
}

function answerFix(k) {
  const it = FIX.items[FIX.i], id = window.AMDrills.itemId(it);
  const prev = ns('attempt')[id] || {};
  const right = k === it.answer;
  FIX.pick = k; FIX.n++; FIX.hit += right ? 1 : 0;
  /* ok נשאר 0 עד סימון "הבנתי": תשובה נכונה אחת בחזרה אינה סגירה. */
  put('attempt', id, Object.assign({}, prev, {
    c: k, ok: 0, tries: (prev.tries || 1) + 1, back: (prev.back || 0) + 1, at: Date.now(),
  }));
  A.bump({ ex: 1, exok: right ? 1 : 0 });
  paintFix();
}
function markFixed(id) {
  const prev = ns('attempt')[id] || {};
  put('attempt', id, Object.assign({}, prev, { ok: 1, fixed: Date.now() }));
}
function step() {
  if (FIX.i + 1 >= FIX.items.length) {
    const h = FIX.hit, n = FIX.n;
    FIX = null; A.closeStudy(); A.render(); toast(h + '/' + n + ' בחזרה');
    return;
  }
  FIX.i++; FIX.pick = null; paintFix();
}

/* ---------- המסך ---------- */
function fix(v) {
  const mist = MISTAKES(), stuck = stuckWords(), acc = accuracy();

  A.head(v, 'בנק הטעויות', 'כל שאלה שטעית בה נשארת כאן עד שתסמן "הבנתי".');

  const by = { sc: 0, rs: 0, rc: 0 };
  mist.forEach((m) => { if (m.kind in by) by[m.kind]++; });
  const g = el('div', 'statgrid sec');
  Object.keys(KIND).forEach((k) => {
    g.innerHTML += '<div class="stat"><div class="v">' + by[k] + '</div>' +
      '<div class="l">' + esc(KIND[k].he) + '</div>' +
      '<div class="s">' + (acc[k].pct == null ? 'טרם נמדד' : 'דיוק ' + acc[k].pct + '% · ' + acc[k].n + ' שאלות') + '</div></div>';
  });
  g.innerHTML += '<div class="stat"><div class="v">' + stuck.length + '</div>' +
    '<div class="l">מילים תקועות</div><div class="s">אסוציאציה שלא מצילה</div></div>';
  v.appendChild(g);

  const go = el('button', mist.length ? 'btn' : 'btn ghost',
    mist.length ? 'תרגל את הטעויות · ' + Math.min(mist.length, 10) + ' שאלות' : 'אין טעויות פתוחות');
  go.disabled = !mist.length;
  go.onclick = startFix;
  v.appendChild(go);

  if (mist.length > 10) {
    v.appendChild(el('p', 'note', 'הבנק מגיש עשר בכל פעם, החדשות ביותר קודם. ' +
      'שאלה שנסגרה לא חוזרת.'));
  }

  if (stuck.length) {
    const s = el('div', 'sec');
    s.appendChild(el('span', 'eyebrow', 'מילים תקועות · ' + stuck.length));
    s.appendChild(el('p', 'note',
      'המילים שהאסוציאציה שלהן לא הצליחה להציל אותך. כתיבה מחדש היא התיקון היחיד שעובד.'));
    stuck.slice(0, 40).forEach((w) => {
      const o = S.words.get(w) || { w };
      const it = el('div', 'item',
        '<div class="w">' + esc(w) + '</div>' +
        '<div class="b"><b>' + esc(o.he || o.def || '') + '</b><br>' +
        esc(A.assoc(w) || '— אין אסוציאציה —') + '</div>');
      const b = el('button', 'hint', 'כתוב מחדש');
      b.onclick = () => A.editAssoc(w, () => A.render());
      it.appendChild(b);
      s.appendChild(it);
    });
    v.appendChild(s);
  }
}

window.AMToday = { home, fix };

})();
