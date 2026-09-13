/* ================= אמירנט — מסך המילים =================

   המאגר היה עד עכשיו מכונת שינון בלבד: מילים נכנסו לתור ויצאו ממנו,
   ולא הייתה שום דרך לשאול "מה זה X" או "איפה נתקלתי בזה". המסך הזה
   הופך אותו למילון אישי.

   דף המילה מראה את מה שאף אחד מהמסכים האחרים לא מראה יחד: המשמעות,
   האסוציאציה שלך, מצב ה-FSRS ומתי המילה חוזרת, ו**כל הפעמים שהמילה
   הופיעה במבחן** — כתשובה או כמסיח, עם המשפט עצמו. לראות ש-scarce
   הופיעה בארבעה מבחנים, פעמיים כתשובה, משנה את היחס אליה.
   ============================================================== */
'use strict';

(function () {

const A = window.AM;
const { el, esc, toast, ns, put, pref, setPref, card, assoc, bucket, S,
        today, addDays, between, heDate } = A;

const FILTERS = [
  ['all',   'הכול'],
  ['new',   'לא מוינו'],
  ['due',   'בפירעון'],
  ['stuck', 'תקועות'],
  ['known', 'ידועות'],
];

const st = () => Object.assign({ q: '', f: 'all' }, pref('wordsUI', {}));
const save = (p) => setPref('wordsUI', Object.assign(st(), p));

function matches(w, o, f) {
  const c = card(w);
  if (f === 'new')   return !c;
  if (f === 'due')   return !!(c && c.d && c.d <= today());
  if (f === 'stuck') return !!(c && ((c.af || 0) >= 2 || (c.l || 0) >= 3));
  if (f === 'known') return !!(c && c.known);
  return true;
}

const BUCKET_HE = { new: 'טרם נלמדה', young: 'טרייה', solid: 'יציבה', strong: 'מבוססת' };

/* ---------- איפה המילה הופיעה במבחנים ----------
   נטען פעם אחת לסשן ונשמר במפה. בלי זה כל פתיחת דף מילה הייתה סורקת
   1,267 פריטים מחדש. */
let INDEX = null;
async function buildIndex() {
  if (INDEX) return INDEX;
  const rows = await A.bank('sc');
  INDEX = new Map();
  if (!rows) return INDEX;
  rows.forEach((it) => {
    it.options.forEach((o, k) => {
      const key = String(o).toLowerCase().trim();
      if (!INDEX.has(key)) INDEX.set(key, []);
      INDEX.get(key).push({ answer: k === it.answer, stem: it.stem, full: it.full, exam: it.exam });
    });
  });
  return INDEX;
}

/* ============================================================
   הרשימה
   ============================================================ */
function view(v) {
  const c = st();

  const head = el('div', 'sec');
  head.appendChild(el('span', 'eyebrow', 'המילים · ' + S.words.size + ' ממבחני אמת'));
  const q = el('input', 't');
  q.type = 'search';
  q.placeholder = 'חפש באנגלית או בעברית…';
  q.setAttribute('aria-label', 'חיפוש מילה');
  q.value = c.q;
  q.style.cssText = 'width:100%';
  head.appendChild(q);

  const tabs = el('div', 'chips');
  FILTERS.forEach(([k, he]) => {
    const b = el('button', 'chip' + (c.f === k ? ' on' : ''), esc(he));
    b.onclick = () => { save({ f: k }); A.render(); };
    tabs.appendChild(b);
  });
  head.appendChild(tabs);
  v.appendChild(head);

  const list = el('div', 'sec');
  v.appendChild(list);

  const paint = () => {
    const term = q.value.trim().toLowerCase();
    save({ q: term });
    list.innerHTML = '';
    const hits = [];
    S.words.forEach((o, w) => {
      if (hits.length >= 200) return;
      if (!matches(w, o, c.f)) return;
      if (term && w.indexOf(term) < 0 && (o.he || '').indexOf(term) < 0 &&
          (o.def || '').toLowerCase().indexOf(term) < 0) return;
      hits.push(w);
    });
    if (!hits.length) {
      list.appendChild(el('div', 'empty', term
        ? 'אין התאמה ל־"' + esc(term) + '". החיפוש עובר על המילה, התרגום וההגדרה.'
        : 'אין מילים בסינון הזה.'));
      return;
    }
    list.appendChild(el('div', 'tiny dim', hits.length >= 200
      ? 'מוצגות 200 הראשונות — צמצם בחיפוש' : hits.length + ' מילים'));
    hits.forEach((w) => {
      const o = S.words.get(w), cd = card(w);
      const b = el('button', 'wrow');
      b.innerHTML =
        '<span class="ww">' + esc(w) + '</span>' +
        '<span class="wm">' + esc(o.he || o.def || '') + '</span>' +
        '<span class="wb b-' + bucket(cd) + '"></span>';
      b.onclick = () => openWord(w);
      list.appendChild(b);
    });
  };
  q.oninput = paint;
  paint();
}

/* ============================================================
   דף המילה
   ============================================================ */
async function openWord(w) {
  const o = S.words.get(w) || { w };
  const cd = card(w);
  const c = el('div', 'card'), mid = el('div', 'mid');
  mid.style.justifyContent = 'flex-start';

  let h = '<div class="head-en">' + esc(w) + '</div>';
  if (o.pos) h += '<div class="pos">' + esc(o.pos) + '</div>';
  if (o.def) h += '<div class="def">' + esc(o.def) + '</div>';
  if (o.syn && o.syn.length) h += '<div class="syn">' + o.syn.map(esc).join('  ·  ') + '</div>';
  if (o.he) h += '<div class="he">' + esc(o.he) + '</div>';
  mid.innerHTML = h;

  /* מצב הכרטיס */
  const state = el('div', 'sec');
  state.appendChild(el('span', 'eyebrow', 'מצב'));
  if (!cd) {
    state.appendChild(el('div', 'note', 'המילה עוד לא נכנסה ללימוד. היא תגיע בתורה, ' +
      'או שאפשר לסמן אותה כידועה במיון המהיר.'));
  } else {
    const left = between(today(), cd.d || today());
    state.appendChild(el('div', 'statgrid',
      '<div class="stat"><div class="v">' + esc(BUCKET_HE[bucket(cd)]) + '</div>' +
      '<div class="l">בשלות</div><div class="s">יציבות ' + Math.round(cd.st || 0) + ' ימים</div></div>' +
      '<div class="stat"><div class="v">' + (left <= 0 ? 'היום' : left + ' ימים') + '</div>' +
      '<div class="l">החזרה הבאה</div><div class="s">' + esc(heDate(cd.d || today())) + '</div></div>' +
      '<div class="stat"><div class="v">' + (cd.r || 0) + '</div>' +
      '<div class="l">חזרות</div><div class="s">' + (cd.l || 0) + ' נפילות</div></div>' +
      '<div class="stat"><div class="v">' + (cd.known ? 'כן' : 'לא') + '</div>' +
      '<div class="l">סומנה כידועה</div><div class="s">' +
      (cd.known ? 'חוזרת פעם אחת לפני המבחן' : 'בתור הרגיל') + '</div></div>'));
  }
  mid.appendChild(state);

  /* אסוציאציה */
  const as = el('div', 'sec');
  as.appendChild(el('span', 'eyebrow', 'האסוציאציה שלך'));
  as.appendChild(el('div', 'note', assoc(w) ? esc(assoc(w))
    : 'אין עדיין. אסוציאציה היא מה שמחזיק את המילה — כתוב משהו שמחבר ' +
      'את הצליל או הצורה למשמעות.'));
  const ab = el('button', 'btn ghost sm', assoc(w) ? 'ערוך' : 'כתוב אסוציאציה');
  ab.onclick = () => A.editAssoc(w, () => { A.closeStudy(); openWord(w); });
  as.appendChild(ab);
  mid.appendChild(as);

  /* איפה היא הופיעה */
  const occ = el('div', 'sec');
  occ.appendChild(el('span', 'eyebrow', 'במבחנים'));
  occ.appendChild(el('div', 'note', 'טוען…'));
  mid.appendChild(occ);

  const acts = el('div', 'acts');
  if (cd && !cd.known) {
    const k = el('button', 'btn ghost', 'אני כבר יודע את זה');
    k.onclick = () => { A.markKnown(w); toast('סומנה כידועה'); A.closeStudy(); A.render(); };
    acts.appendChild(k);
  }
  const close = el('button', 'btn', 'סגור');
  close.onclick = () => { A.closeStudy(); };
  acts.appendChild(close);
  c.append(mid, acts);
  A.openStudy(c, { i: 0, n: 1, right: '', close: () => {} }).className = 'study m-elim';

  /* המופעים נטענים אחרי הציור — הם דורשים את הבנק, וכל השאר לא. */
  const idx = await buildIndex();
  const rows = idx.get(String(w).toLowerCase().trim()) || [];
  occ.innerHTML = '';
  occ.appendChild(el('span', 'eyebrow', 'במבחנים · ' + rows.length +
    (rows.length ? ' (' + rows.filter((r) => r.answer).length + ' כתשובה)' : '')));
  if (!rows.length) {
    occ.appendChild(el('div', 'note', idx.size
      ? 'המילה לא הופיעה כאפשרות בשאלות השלמת המשפטים שבמאגר.'
      : 'בנק השאלות לא נטען — התחבר כדי לראות איפה המילה הופיעה.'));
  } else {
    rows.slice(0, 8).forEach((r) => {
      const row = el('div', 'occ' + (r.answer ? ' ok' : ''));
      row.innerHTML = '<div class="mk">' + (r.answer ? '✓' : '·') + '</div>' +
        '<div class="en">' + (r.answer && r.full
          ? A.highlightWord(r.full, w) : A.examSentence(r.stem)) + '</div>';
      occ.appendChild(row);
    });
    occ.appendChild(el('p', 'note', rows.filter((r) => r.answer).length
      ? 'הופיעה כתשובה נכונה — כלומר זו מילה שהמבחן באמת דורש לדעת.'
      : 'הופיעה רק כמסיח. עדיין שווה לדעת: פסילה שלה היא מה שמקצר את הבחירה.'));
  }
}

window.AMWords = { view, open: openWord };

})();
