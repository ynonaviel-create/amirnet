/* ================= אמירנט — משימת היום ובנק הטעויות =================

   שני מסכים שנולדו מאותה תלונה: "הסידור". רשימת כפתורים לא אומרת מה
   לעשות עכשיו, ומערכת שלא זוכרת על מה טעית נותנת לטעות לחזור עשר פעמים
   בשקט.

   מסך "היום" לא מציע — הוא מחליט. הוא סופר מה בפירעון, מה לא מוין,
   באיזה פרק הדיוק הנמוך ביותר, כמה טעויות פתוחות, וכמה זמן באמת נשאר
   היום (ערב שבת וערב חג מקצרים את המשימה). התוצאה היא שלוש-ארבע
   משימות עם סיבה מספרית לכל אחת. מתחת להן "משהו אחר" — שום מסלול
   לא נחסם, אבל צריך להיות ברור מה הכי שווה עכשיו.
   ============================================================== */
'use strict';

(function () {

const A = window.AM;
const { el, esc, toast, ns, put, pref, setPref, card, bucket, S,
        today, addDays, between, isOff, isHalf, studyDaysLeft } = A;

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

/* ---------- כמה זמן יש היום ----------
   ערב שבת וערב חג הם ימים קצרים בפועל, ומשימה שלא מתכווצת בהם היא
   משימה שלא תיעשה. */
function budget() {
  const t = today();
  if (isOff(t)) return { min: 0, why: 'שבת או חג' };
  if (isHalf(t)) return { min: 20, why: 'ערב שבת או ערב חג' };
  return { min: 45, why: null };
}
const mmss = (min) => min >= 60 ? Math.round(min / 60 * 10) / 10 + ' שעות' : Math.round(min) + ' דק\'';

/* ============================================================
   מסך היום
   ============================================================ */

function missionCard(v, m) {
  const b = el('button', 'mission m-' + (m.mode || 'exam'));
  b.innerHTML =
    '<div class="mh"><span class="mt">' + esc(m.title) + '</span>' +
    '<span class="mm">' + esc(m.time) + '</span></div>' +
    '<div class="mw">' + m.why + '</div>' +
    (m.done ? '<div class="mdone">✓ ' + esc(m.done) + '</div>' : '');
  b.onclick = m.go;
  v.appendChild(b);
}

function home(v) {
  const p = A.plan(), d = A.day(), nTri = A.untriaged().length;
  const left = between(today(), S.exam);
  const bud = budget();
  const acc = accuracy();
  const mist = MISTAKES(), stuck = stuckWords();

  /* השורה העליונה — ארבעה מספרים, בלי פרשנות */
  v.appendChild(el('div', 'figs',
    '<div class="fig due"><span class="n">' + p.dueN + '</span><span class="k">לחזרה</span></div>' +
    '<div class="fig new"><span class="n">' + p.newN + '</span><span class="k">חדשות</span></div>' +
    '<div class="fig"><span class="n">' + d.rev + '</span><span class="k">היום</span></div>' +
    '<div class="fig"><span class="n">' + A.streak() + '</span><span class="k">רצף</span></div>'));

  if (!bud.min) {
    v.appendChild(el('div', 'sec',
      '<span class="eyebrow">' + esc(bud.why) + '</span>' +
      '<p class="note">אין משימה היום. אם הכנת דף הדפסה, הוא ממתין לך תחת <b>עוד ← הדפסה</b>, ' +
      'והפיוס אחרי השבת יעדכן את התור.</p>'));
  }

  /* ---- בניית המשימה ---- */
  const M = [];

  const TRI_BATCH = 120;
  if (nTri) {
    const batch = Math.min(nTri, TRI_BATCH);
    M.push({
      title: 'מיון מהיר · ' + batch + ' מילים', mode: 'exam',
      time: mmss(Math.max(1, batch * 3 / 60)),
      why: '<b>' + nTri + '</b> מילים במאגר שעוד לא אמרת עליהן כלום. כל מילה שתסמן כידועה ' +
           'יוצאת מהתור וחוזרת פעם אחת בלבד לפני המבחן — ככה לא תבזבז ימים על מה שכבר בראש.',
      go: () => A.startTriage(TRI_BATCH),
    });
  }

  const cards = p.dueN + p.newN;
  if (cards) M.push({
    title: 'אוצר מילים', mode: 'exam',
    time: mmss(cards * 11 / 60),
    why: p.dueN
      ? '<b>' + p.dueN + '</b> כרטיסים בפירעון היום' + (p.newN ? ' ו‑<b>' + p.newN + '</b> חדשים' : '') +
        '. כרטיס שנדחה יורד ביציבות ומחייב חזרה מוקדמת יותר.'
      : '<b>' + p.newN + '</b> מילים חדשות. אין כרגע חוב חזרות.',
    done: d.rev ? d.rev + ' כרטיסים כבר נעשו היום' : null,
    go: A.startStudy,
  });

  /* הפרק החלש — נבחר לפי דיוק, ומוצג עם המשקל שלו בציון */
  const weak = Object.keys(KIND)
    .filter((k) => acc[k].n >= 8)
    .sort((a, b) => acc[a].pct - acc[b].pct)[0];
  if (weak && acc[weak].pct < 80) {
    const K = KIND[weak];
    M.push({
      title: 'הפרק החלש שלך — ' + K.he, mode: K.mode,
      time: '4 דק\'',
      why: 'הדיוק שלך שם <b>' + acc[weak].pct + '%</b> על ' + acc[weak].n + ' שאלות, והפרק שווה <b>' +
           Math.round(100 * K.weight / TOTALQ) + '%</b> מהציון (' + K.weight + ' מתוך ' + TOTALQ + ' שאלות).',
      go: () => weak === 'rc' ? window.AMDrills.rc('sprint') : window.AMDrills.section(weak),
    });
  }

  if (mist.length >= 3) M.push({
    title: 'בנק הטעויות', mode: 'trap',
    time: mmss(Math.min(mist.length, 8) * 45 / 60),
    why: '<b>' + mist.length + '</b> שאלות שטעית בהן ולא סגרת. שאלה שנשארת פתוחה חוזרת במבחן.',
    go: () => A.go('fix'),
  });

  /* פסילה — נכנסת כשלא נוגעים בה, או כשהדיוק שלה נמוך */
  const E = Object.assign({ n: 0, rej: 0, good: 0, fatal: 0 }, pref('elim', {}));
  const eacc = E.rej ? Math.round(100 * E.good / E.rej) : null;
  if (!E.n) M.push({
    title: 'דריל פסילה', mode: 'elim', time: '5 דק\'',
    why: 'עוד לא ניסית. ידיעה של שתיים מארבע האפשרויות, בלי לדעת מי הנכונה, שווה <b>75%</b> — ' +
         'וזה 12 מתוך 23 השאלות במבחן.',
    go: () => window.AMStrat.elim('sc', 8),
  });
  else if (eacc != null && eacc < 85) M.push({
    title: 'דריל פסילה', mode: 'elim', time: '5 דק\'',
    why: 'דיוק הפסילה שלך <b>' + eacc + '%</b>' + (E.fatal ? ' ופסלת את התשובה הנכונה <b>' + E.fatal + '</b> פעמים' : '') +
         '. ברמה הזו הפסילה מנחשת ולא מרוויחה.',
    go: () => window.AMStrat.elim('sc', 8),
  });

  if (stuck.length >= 5 && M.length < 4) M.push({
    title: 'מילים תקועות', mode: 'read',
    time: mmss(Math.min(stuck.length, 12) * 25 / 60),
    why: '<b>' + stuck.length + '</b> מילים שהאסוציאציה שלהן לא מצילה אותך. כתיבה מחדש היא התיקון היחיד שעובד.',
    go: () => A.go('fix'),
  });

  /* קיצוץ לפי הזמן שבאמת יש היום */
  const sec = el('div', 'sec');
  sec.appendChild(el('span', 'eyebrow',
    'משימת היום' + (bud.why ? ' · ' + bud.why : '') + (M.length ? ' · ' + M.length + ' משימות' : '')));
  if (!M.length) {
    sec.appendChild(el('div', 'empty', 'הכול נקי להיום. ' +
      (left > 0 ? left + ' ימים למבחן.' : '')));
  } else {
    const short = !!(bud.min && bud.min < 30);
    const cut = short ? M.slice(0, 2) : M.slice(0, 4);
    cut.forEach((m) => missionCard(sec, m));
    const rest = M.length - cut.length;
    if (rest) {
      sec.appendChild(el('p', 'note',
        (rest === 1 ? 'עוד משימה אחת ממתינה' : 'עוד ' + rest + ' משימות ממתינות') +
        (short ? '. היום קצר — אלה הכי שוות.' : '. אלה הכי שוות עכשיו.')));
    }
  }
  const other = el('button', 'btn ghost', 'משהו אחר');
  other.onclick = () => A.go('drill');
  sec.appendChild(other);
  v.appendChild(sec);

  if (left <= 12 && left >= 0) {
    v.appendChild(el('div', 'note',
      '<b style="color:var(--warn)">מצב סגירה.</b> נשארו ' + left +
      ' ימים — יעד הזכירה הועלה ל‑94% ואף מילה לא מתוזמנת אחרי המבחן.'));
  }

  maturity(v);
}

/* ---------- בשלות המאגר ---------- */
function maturity(v) {
  const cnt = { new: 0, young: 0, solid: 0, strong: 0 };
  S.words.forEach((o, w) => { cnt[bucket(card(w))]++; });
  const tot = S.words.size || 1;
  const sec = el('div', 'sec');
  sec.appendChild(el('span', 'eyebrow', 'המאגר · ' + S.words.size + ' מילים ממבחני אמת'));
  sec.appendChild(el('div', 'bar',
    '<i style="width:' + (cnt.strong / tot * 100) + '%;background:var(--good)"></i>' +
    '<i style="width:' + (cnt.solid / tot * 100) + '%;background:var(--accent);opacity:.7"></i>' +
    '<i style="width:' + (cnt.young / tot * 100) + '%;background:var(--warn);opacity:.6"></i>'));
  sec.appendChild(el('div', 'legend',
    '<span><i class="dot" style="background:var(--good)"></i>מבוססות ' + cnt.strong + '</span>' +
    '<span><i class="dot" style="background:var(--accent);opacity:.7"></i>יציבות ' + cnt.solid + '</span>' +
    '<span><i class="dot" style="background:var(--warn);opacity:.6"></i>טריות ' + cnt.young + '</span>' +
    '<span><i class="dot" style="background:var(--surface-2)"></i>טרם נלמדו ' + cnt.new + '</span>'));

  const rem = cnt.new;
  if (rem) {
    const days = Math.max(1, studyDaysLeft(today(), S.exam) - 10);
    const need = Math.ceil(rem / days);
    sec.appendChild(el('div', 'note',
      'נותרו <b>' + rem + '</b> מילים שלא נגעת בהן, ו‑<b>' + Math.round(studyDaysLeft(today(), S.exam)) +
      '</b> ימי לימוד בפועל עד המבחן (שבתות וחגים כבר מנוכים). כדי לכסות אותן לפני שלב הסגירה ' +
      'צריך <b>' + need + ' מילים חדשות ביום</b> — היעד הנוכחי הוא ' + A.pref('newPerDay', 35) +
      (need <= A.pref('newPerDay', 35) ? ' ומספיק.' : ' ולא יספיק.')));
  }
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
    (prev.back ? '<div class="tiny dim">חזרת לשאלה הזו ' + prev.back + ' פעמים</div>' : '');

  if (it.kind === 'rc' && FIX.ps && FIX.ps.get(it.passage)) {
    const p = el('div', 'passage');
    p.innerHTML = FIX.ps.get(it.passage).text.split(/\n{2,}/)
      .map((t) => '<p>' + esc(t.trim()) + '</p>').join('');
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

  const head = el('div', 'sec');
  head.appendChild(el('span', 'eyebrow', 'בנק הטעויות'));
  head.appendChild(el('p', 'note',
    'כל שאלה שטעית בה נשארת כאן עד שתסמן "הבנתי" — תשובה נכונה אחת בחזרה היא ראיה, לא סגירה. ' +
    'בלי הלולאה הזו אפשר לטעות באותה שאלה עשר פעמים בלי שאיש ידע.'));
  v.appendChild(head);

  const by = { sc: 0, rs: 0, rc: 0 };
  mist.forEach((m) => { if (m.kind in by) by[m.kind]++; });
  const g = el('div', 'statgrid');
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
