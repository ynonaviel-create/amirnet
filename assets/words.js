/* ================= אמירנט — מסך המילים =================

   המאגר היה עד עכשיו מכונת שינון בלבד: מילים נכנסו לתור ויצאו ממנו,
   ולא הייתה שום דרך לשאול "מה זה X" או "איפה נתקלתי בזה". המסך הזה
   הופך אותו למילון אישי.

   דף המילה מראה את מה שאף אחד מהמסכים האחרים לא מראה יחד: המשמעות,
   האסוציאציה שלך, המצב בלומדה ומתי המילה חוזרת, ו**כל הפעמים שהמילה
   הופיעה במבחן** — כתשובה או כמסיח, עם המשפט עצמו. לראות ש-scarce
   הופיעה בארבעה מבחנים, פעמיים כתשובה, משנה את היחס אליה.
   ============================================================== */
'use strict';

(function () {

const A = window.AM;
const { el, esc, toast, card, assoc, bucket, S, today, between, heDate } = A;

const FILTERS = [
  ['all',    'הכול'],
  ['learn',  'לשינון'],
  ['drill',  'בתרגול'],
  ['hot',    'נשכחו'],
  ['master', 'שוחררו'],
  ['known',  'ידועות'],
  ['new',    'חדשות'],
];

/* מצב החיפוש נשאר במכשיר. כהעדפה מסונכרנת כל הקשה הייתה נשלחת לענן. */
const st = () => { try { return Object.assign({ q: '', f: 'all' }, JSON.parse(localStorage.getItem('amirnet.wordsUI')) || {}); } catch (e) { return { q: '', f: 'all' }; } };
const save = (p) => { try { localStorage.setItem('amirnet.wordsUI', JSON.stringify(Object.assign(st(), p))); } catch (e) {} };

const L = () => window.AMLomda;
function matches(w, o, f) {
  if (f === 'all') return true;
  const s = L().status(w);
  if (f === 'hot') { const c = card(w); return s === 'drill' && !!(c && c.hot); }
  if (f === 'known') return s === 'known' || s === 'placed';
  return s === f;
}

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
  head.appendChild(el('span', 'eyebrow', 'המילון · ' + S.words.size.toLocaleString('en-US') + ' מילים'));
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
    b.onclick = () => { save({ f: k }); tabs.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === b)); c.f = k; paint(); };
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
      ? 'מוצגות 200 הראשונות — צמצם בחיפוש' : A.plural(hits.length, 'מילה אחת', 'מילים')));
    hits.forEach((w) => {
      const o = S.words.get(w), cd = card(w);
      const b = el('button', 'wrow');
      b.innerHTML =
        '<span class="ww">' + esc(w) + (o.lv ? ' <small class="lvtag">' + o.lv + '</small>' : '') + '</span>' +
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

  mid.innerHTML = '<div class="head-en">' + esc(w) + '</div>' + A.meaning(o, false);

  /* מצב בלומדה */
  const state = el('div', 'sec');
  const stw = L().status(w);
  state.appendChild(el('span', 'eyebrow', 'בלומדה'));
  state.appendChild(el('div', 'statgrid',
    '<div class="stat"><div class="v">' + (o.lv || '—') + '</div><div class="l">רמה</div>' +
    '<div class="s">מקום ' + (o.fr || '—') + ' בתדירות</div></div>' +
    '<div class="stat"><div class="v">' + esc(L().STATUS_HE[stw] || stw) + '</div><div class="l">מצב</div>' +
    '<div class="s">' + (cd && cd.hot ? 'נשכחה — תחזור בתרגולים הקרובים' : stw === 'drill' ? 'רצף ' + (cd.streak || 0) + ' מתוך 4' : '&nbsp;') + '</div></div>' +
    '<div class="stat"><div class="v">' + ((cd && cd.r) || 0) + '</div><div class="l">תרגולים</div>' +
    '<div class="s">' + ((cd && cd.l) || 0) + ' טעויות</div></div>' +
    '<div class="stat"><div class="v">' + (cd && cd.d && stw === 'drill' ? (between(today(), cd.d) <= 0 ? 'היום' : A.plural(between(today(), cd.d), 'מחר', 'ימים')) : '—') + '</div>' +
    '<div class="l">חוזרת</div><div class="s">' + (cd && cd.d && stw === 'drill' ? esc(heDate(cd.d)) : '&nbsp;') + '</div></div>'));
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
  if (stw === 'new' || stw === 'learn') {
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
