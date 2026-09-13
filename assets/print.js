/* ================= אמירנט — הדפסה =================

   שבתות וחגים הם כשליש מהזמן שנשאר, ובלעדיהם הקצב לא נסגר. הדף המודפס
   הוא הדרך היחידה ללמוד בהם, ולכן הוא לא נספח אלא מסלול.

   שלוש פריסות, כי לשלוש משימות שונות:
   · גיליון לימוד — לקריאה ולסימון. מה שנלמד בפועל בשבת.
   · כרטיסיות מתקפלות — לשליפה אקטיבית. גוזרים, מקפלים, מכסים.
   · דף תרגול — שאלות מבחן אמיתיות, מפתח בעמוד נפרד.

   כל פריסה נבנית כרצף עמודים ולא כזרם אחד, ולכן ספירת העמודים כאן
   היא ספירה ולא הערכה, והתצוגה המקדימה היא באמת מה שייצא מהמדפסת.
   ============================================================== */
'use strict';

(function () {

const A = window.AM;
const { el, esc, toast, ns, put, pref, setPref, card, assoc, S,
        today, addDays, between, heDate, isOff } = A;

/* אומדן גס לתווית הבחירה בלבד. הספירה האמיתית נעשית במדידה בתצוגה
   המקדימה, כי גובה שורה תלוי באורך ההגדרה ובאסוציאציה. */
const EST = { study: 18, fold: 8, drill: 7 };

const LAYOUT = {
  study: { he: 'גיליון לימוד', sub: 'מילה, משמעות, האסוציאציה שלך ומשבצת סימון. לקריאה ולסימון.' },
  fold:  { he: 'כרטיסיות מתקפלות', sub: 'שמונה לעמוד. גוזרים, מקפלים, והמשמעות מאחור. לשליפה אקטיבית.' },
  drill: { he: 'דף תרגול', sub: 'שאלות מבחן אמיתיות. מפתח התשובות בעמוד נפרד.' },
};

/* ---------- טווחים ---------- */
function offRuns(from, days) {
  /* רצפים של ימים סגורים — שבת בודדת היא רצף של אחד, סוכות הוא רצף ארוך. */
  const runs = [];
  let cur = null;
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i);
    if (isOff(d)) { if (!cur) { cur = [d, d]; runs.push(cur); } else cur[1] = d; }
    else cur = null;
  }
  return runs;
}
function ranges() {
  const runs = offRuns(today(), 40);
  const out = [];
  const single = runs.find((r) => r[0] === r[1]);
  if (single) out.push({ k: 'shabbat', he: 'השבת הקרובה', upto: single[1], days: 1, when: esc(heDate(single[0])) });
  const long = runs.find((r) => r[0] !== r[1]);
  if (long) out.push({ k: 'chag', he: 'החג הקרוב', upto: long[1],
    days: between(long[0], long[1]) + 1, when: '<span class="rng">' + heDate(long[0]) + ' – ' + heDate(long[1]) + '</span>' });
  out.push({ k: 'week', he: 'השבוע הקרוב', upto: addDays(today(), 7), days: 7, when: 'עד ' + esc(heDate(addDays(today(), 7))) });
  return out;
}

/* ---------- מקורות ---------- */
function sourceWords(keys, upto) {
  const cs = ns('cards'), set = new Set();
  const add = (w) => { if (S.words.has(w)) set.add(w); };
  if (keys.has('due')) for (const w in cs) if (cs[w].d && cs[w].d <= upto) add(w);
  if (keys.has('stuck')) for (const w in cs) if ((cs[w].af || 0) >= 2 || (cs[w].l || 0) >= 3) add(w);
  if (keys.has('new')) {
    const pri = ns('prefs');
    let n = 0;
    S.words.forEach((o, w) => { if (!cs[w] && (pri['pri.' + w] || 3) === 3 && n < 120) { set.add(w); n++; } });
  }
  if (keys.has('picked')) (pref('printPick', []) || []).forEach(add);
  return [...set];
}
const SOURCES = [
  ['due',    'מילים בפירעון', 'מה שהתזמון מבקש עד סוף הטווח'],
  ['stuck',  'מילים תקועות',  'אסוציאציה שלא מצילה — נפילות חוזרות'],
  ['new',    'מילים שלא מוינו', 'עד 120, לפי תדירות במבחנים'],
  ['picked', 'הבחירה הידנית שלי', 'מה שסימנת מהמאגר'],
];

/* ---------- מצב המסך ---------- */
const st = () => Object.assign(
  { range: 'shabbat', src: ['due'], layout: 'study' }, pref('printCfg', {}));
const save = (patch) => setPref('printCfg', Object.assign(st(), patch));

/* ============================================================
   בניית העמודים
   ============================================================ */
const meaningOf = (w) => {
  const o = S.words.get(w) || {};
  return [o.def || '', o.he || ''].filter(Boolean).join(' — ');
};

function pageEl() {
  const frame = el('div', 'pageframe');
  const p = el('div', 'page');
  frame.appendChild(p);
  return { frame, p };
}
function headEl(head, sub) {
  return '<div class="phead"><span>' + esc(head) + '</span><span class="ps">' + esc(sub) + '</span></div>';
}

/* ---------- חלוקה לעמודים במדידה ----------
   מוסיפים פריט, בודקים אם חרג מהתיבה, ואם כן מחזירים אותו לעמוד הבא.
   העמוד על המסך הוא 210×297 מ"מ אמיתיים, ולכן המדידה תקפה להדפסה. */
function paginate(items, makeEl, head, sub) {
  const probe = el('div', 'page');
  probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;transform:none';
  probe.innerHTML = headEl(head, sub);
  document.body.appendChild(probe);
  const limit = probe.clientHeight - parseFloat(getComputedStyle(probe).paddingTop) * 2;
  const groups = [[]];
  let used = probe.lastElementChild.getBoundingClientRect().height +
             parseFloat(getComputedStyle(probe.lastElementChild).marginBottom);
  const base = used;
  items.forEach((it) => {
    const node = makeEl(it, groups[groups.length - 1].length);
    probe.appendChild(node);
    const h = node.getBoundingClientRect().height;
    if (used + h > limit && groups[groups.length - 1].length) {
      groups.push([]); used = base;
    }
    used += h;
    groups[groups.length - 1].push(it);
    probe.removeChild(node);
  });
  probe.remove();
  return groups;
}

function render(groups, head, subOf, makeEl, wrapCls) {
  return groups.map((g, i) => {
    const { frame, p } = pageEl();
    p.innerHTML = headEl(head, subOf(i, groups.length));
    const host = wrapCls ? el('div', wrapCls) : p;
    g.forEach((it, k) => host.appendChild(makeEl(it, k)));
    if (wrapCls) p.appendChild(host);
    return frame;
  });
}

const studyRow = (w) => {
  const r = el('div', 'prow');
  r.innerHTML = '<div class="box"></div>' +
    '<div class="w">' + esc(w) + '</div>' +
    '<div><div class="m">' + esc(meaningOf(w)) + '</div>' +
    (assoc(w) ? '<div class="a">' + esc(assoc(w)) + '</div>' : '') + '</div>';
  return r;
};
function buildStudy(words) {
  const H = 'אמירנט · גיליון לימוד';
  const g = paginate(words, studyRow, H, 'x');
  return render(g, H, (i, n) => heDate(today()) + ' · עמוד ' + (i + 1) + ' מתוך ' + n, studyRow);
}

/* כרטיסיות: החצי התחתון מסובב, כדי שאחרי קיפול לאחור הוא ייקרא נכון */
const foldCard = (w) => {
  const c = el('div', 'fcard');
  c.innerHTML =
    '<div class="face front"><span class="fw">' + esc(w) + '</span></div>' +
    '<div class="fold"></div>' +
    '<div class="face back"><span class="fm">' + esc(meaningOf(w) || '—') + '</span></div>';
  return c;
};
function buildFold(words) {
  const H = 'אמירנט · כרטיסיות';
  const groups = [];
  for (let i = 0; i < words.length; i += 8) groups.push(words.slice(i, i + 8));
  return render(groups, H,
    (i, n) => 'גזור בקווים המלאים, קפל בקו המקווקו · עמוד ' + (i + 1) + ' מתוך ' + n,
    foldCard, 'cards');
}

function buildDrill(items) {
  const H = 'אמירנט · דף תרגול';
  let seq = 0;
  const q = (it) => {
    const n = ++seq;
    const d = el('div', 'q');
    d.innerHTML = '<div class="qs"><b>' + n + '.</b> ' +
      esc(it.stem).replace(/_{2,}/g, '<span class="blank">&nbsp;</span>') + '</div>' +
      '<div class="qo">' + it.options.map((o, k) =>
        '<span><i>(' + (k + 1) + ')</i> ' + esc(o) + '</span>').join('') + '</div>';
    return d;
  };
  const groups = paginate(items, q, H, 'x');
  seq = 0;
  const pages = render(groups, H,
    (i, n) => 'השלמת משפטים · עמוד ' + (i + 1) + ' מתוך ' + (n + 1), q);

  const { frame, p } = pageEl();
  p.innerHTML = headEl('אמירנט · מפתח תשובות', 'הפרד לפני התרגול');
  const kg = el('div', 'keys');
  items.forEach((it, n) => {
    kg.innerHTML += '<span><b>' + (n + 1) + '.</b> (' + (it.answer + 1) + ') ' +
      esc(it.options[it.answer]) + '</span>';
  });
  p.appendChild(kg);
  pages.push(frame);
  return pages;
}

/* ============================================================
   המסך
   ============================================================ */

let DRILLPOOL = null;

function view(v) {
  const c = st();
  const R = ranges();
  const range = R.find((r) => r.k === c.range) || R[0];
  const srcSet = new Set(c.src);
  const words = sourceWords(srcSet, range.upto);

  const head = el('div', 'sec');
  head.appendChild(el('span', 'eyebrow', 'הדפסה לשבתות וחגים'));
  head.appendChild(el('p', 'note',
    'שבתות וחגים הם כשליש מהימים שנשארו. דף מודפס הוא הדרך היחידה ללמוד בהם, ' +
    'ומסך הפיוס אחרי השבת מחזיר את מה שזכרת לתוך התזמון.'));
  v.appendChild(head);

  /* ---- טווח ---- */
  const s1 = el('div', 'sec');
  s1.appendChild(el('span', 'eyebrow', 'טווח'));
  R.forEach((r) => {
    const b = el('button', 'pick' + (r.k === range.k ? ' on' : ''));
    b.innerHTML = '<span class="pt">' + esc(r.he) + '</span>' +
      '<span class="pd">' + r.when + ' · ' + r.days + (r.days === 1 ? ' יום' : ' ימים') + '</span>';
    b.onclick = () => { save({ range: r.k }); A.render(); };
    s1.appendChild(b);
  });
  v.appendChild(s1);

  /* ---- מקור ---- */
  const s2 = el('div', 'sec');
  s2.appendChild(el('span', 'eyebrow', 'מקור'));
  SOURCES.forEach(([k, he, sub]) => {
    const on = srcSet.has(k);
    const n = sourceWords(new Set([k]), range.upto).length;
    const b = el('button', 'pick multi' + (on ? ' on' : '') + (n ? '' : ' off'));
    b.innerHTML = '<span class="pt">' + esc(he) + '<b class="cnt">' + n + '</b></span>' +
      '<span class="pd">' + esc(sub) + '</span>';
    b.onclick = () => {
      const next = new Set(srcSet);
      next.has(k) ? next.delete(k) : next.add(k);
      save({ src: [...next] }); A.render();
    };
    s2.appendChild(b);
  });
  const pickBtn = el('button', 'btn ghost', 'בחירה ידנית מהמאגר · ' + (pref('printPick', []) || []).length);
  pickBtn.onclick = openPicker;
  s2.appendChild(pickBtn);
  v.appendChild(s2);

  /* ---- פריסה ---- */
  const s3 = el('div', 'sec');
  s3.appendChild(el('span', 'eyebrow', 'פריסה'));
  Object.keys(LAYOUT).forEach((k) => {
    const b = el('button', 'pick' + (c.layout === k ? ' on' : ''));
    b.innerHTML = '<span class="pt">' + esc(LAYOUT[k].he) + '</span>' +
      '<span class="pd">' + esc(LAYOUT[k].sub) + '</span>';
    b.onclick = () => { save({ layout: k }); A.render(); };
    s3.appendChild(b);
  });
  v.appendChild(s3);

  /* ---- סיכום ותצוגה מקדימה ---- */
  const s4 = el('div', 'sec');
  const isDrill = c.layout === 'drill';
  const n = isDrill ? 21 : words.length;
  const pages = Math.max(1, Math.ceil(n / EST[c.layout])) + (isDrill ? 1 : 0);
  s4.appendChild(el('div', 'tally',
    '<div><b>' + n + '</b><span>' + (isDrill ? 'שאלות' : 'מילים') + '</span></div>' +
    '<div><b>≈' + pages + '</b><span>' + (pages === 1 ? 'עמוד' : 'עמודים') + '</span></div>' +
    '<div><b>' + esc(LAYOUT[c.layout].he) + '</b><span>פריסה</span></div>'));

  const go = el('button', 'btn', 'תצוגה מקדימה');
  go.disabled = !isDrill && !words.length;
  go.onclick = () => preview(c.layout, words);
  s4.appendChild(go);
  if (!isDrill && !words.length) {
    s4.appendChild(el('div', 'empty', 'לא נבחר מקור עם מילים. סמן מקור אחד לפחות למעלה.'));
  }
  v.appendChild(s4);

  /* ---- פיוס פתוח ---- */
  const batch = ns('print');
  const open = Object.keys(batch).filter((k) => !batch[k].reconciled);
  if (open.length) {
    const s5 = el('div', 'sec');
    s5.appendChild(el('span', 'eyebrow', 'ממתין לפיוס'));
    s5.appendChild(el('p', 'note',
      'הדפסת דף ולא סימנת מה זכרת. בלי זה התזמון לא יודע מה קרה בשבת ' +
      'והמילים יחזרו כאילו לא נגעת בהן. שלושים שניות לכל הדף.'));
    open.forEach((k) => {
      const b = el('button', 'btn', 'סמן מה זכרת · ' + (batch[k].words || []).length + ' מילים · ' + heDate(new Date(batch[k].at).toISOString().slice(0, 10)));
      b.onclick = () => window.AMDrills.reconcile(k);
      s5.appendChild(b);
    });
    v.appendChild(s5);
  }
}

/* ---------- בחירה ידנית ---------- */
function openPicker() {
  const sel = new Set(pref('printPick', []) || []);
  const c = el('div', 'card'), mid = el('div', 'mid');
  mid.style.justifyContent = 'flex-start';
  mid.innerHTML = '<span class="eyebrow">בחירה ידנית</span>';
  const q = el('input', 't mono');
  q.type = 'search'; q.placeholder = 'חפש מילה…'; q.setAttribute('aria-label', 'חיפוש מילה');
  q.style.cssText = 'width:100%;max-width:46ch;direction:ltr;text-align:left';
  const list = el('div', 'picklist');
  const count = el('div', 'tiny dim');
  const paint = () => {
    const term = q.value.trim().toLowerCase();
    list.innerHTML = '';
    count.textContent = sel.size + ' נבחרו';
    const hits = [];
    S.words.forEach((o, w) => {
      if (hits.length >= 60) return;
      if (term && w.indexOf(term) !== 0 && (o.he || '').indexOf(term) < 0) return;
      hits.push(w);
    });
    hits.forEach((w) => {
      const o = S.words.get(w);
      const b = el('button', 'opt' + (sel.has(w) ? ' pick' : ''),
        '<span class="num">' + (sel.has(w) ? '✓' : '+') + '</span>' + esc(w) +
        '<span class="gl" style="display:block">' + esc(o.he || o.def || '') + '</span>');
      b.onclick = () => { sel.has(w) ? sel.delete(w) : sel.add(w); paint(); };
      list.appendChild(b);
    });
    if (!hits.length) list.appendChild(el('div', 'empty', 'אין התאמה'));
  };
  q.oninput = paint;
  mid.append(q, count, list);
  const acts = el('div', 'acts');
  const ok = el('button', 'btn', 'שמור');
  ok.onclick = () => { setPref('printPick', [...sel]); A.closeStudy(); A.render(); };
  const clr = el('button', 'btn ghost', 'נקה הכול');
  clr.onclick = () => { sel.clear(); paint(); };
  acts.append(ok, clr);
  c.append(mid, acts);
  A.openStudy(c, { i: 0, n: 1, right: '', close: () => A.render() });
  paint();
}

/* ---------- תצוגה מקדימה ---------- */
async function preview(layout, words) {
  let pages, batchWords = words;
  if (layout === 'drill') {
    const rows = DRILLPOOL || await A.bank('sc');
    if (!rows || !rows.length) { toast('בנק השאלות לא נטען — התחבר קודם'); return; }
    DRILLPOOL = rows;
    const pool = rows.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const items = pool.slice(0, 21);
    pages = buildDrill(items);
    batchWords = items.map((it) => it.options[it.answer].toLowerCase());
  } else {
    pages = layout === 'fold' ? buildFold(words) : buildStudy(words);
  }

  const v = document.querySelector('#view');
  v.innerHTML = '';
  const bar = el('div', 'sec');
  bar.appendChild(el('span', 'eyebrow', 'תצוגה מקדימה · ' + pages.length +
    (pages.length === 1 ? ' עמוד' : ' עמודים')));
  bar.appendChild(el('p', 'note',
    'זה בדיוק מה שייצא מהמדפסת. ' +
    (layout === 'fold' ? 'הקווים המלאים הם קווי גזירה והמקווקו הוא קו הקיפול.'
     : layout === 'drill' ? 'מפתח התשובות הוא העמוד האחרון — הפרד אותו לפני שאתה מתחיל.'
     : 'המשבצת משמאל היא לסימון תוך כדי; מסך הפיוס אחרי השבת מבקש בדיוק אותה.')));
  const row = el('div', 'acts');
  const pr = el('button', 'btn', 'הדפס');
  pr.onclick = () => {
    if (layout !== 'drill') {
      put('print', 'p' + Date.now(), { words: batchWords, layout, at: Date.now(), reconciled: 0 });
    }
    window.print();
  };
  const back = el('button', 'btn ghost', 'חזרה לבחירה');
  back.onclick = () => A.render();
  row.append(pr, back);
  bar.appendChild(row);
  v.appendChild(bar);

  const sheet = el('div', 'sheet');
  pages.forEach((p) => sheet.appendChild(p));
  v.appendChild(sheet);
  fit(sheet);
  window.scrollTo(0, 0);
}

/* קנה המידה של התצוגה. נמדד מול הרוחב בפועל, ומתעדכן בשינוי גודל חלון. */
function fit(sheet) {
  const set = () => {
    const frame = sheet.querySelector('.pageframe');
    const page = frame && frame.firstElementChild;
    if (!page) return;
    sheet.style.setProperty('--k', frame.clientWidth / page.offsetWidth);
  };
  set();
  new ResizeObserver(set).observe(sheet);   // מת יחד עם הצומת בניווט הבא
}

window.AMPrint = { view };

})();
