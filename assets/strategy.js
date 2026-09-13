/* ================= אמירנט — שכבת האסטרטגיה =================

   הקובץ הזה קיים בגלל מסקנה אחת: אי אפשר ללמוד 1,500 מילים בחודש וחצי,
   וגם לא צריך. חיפשתי במאגר של 58 פרקי אנגלית מ-29 מבחני עבר — 464 השלמת משפטים, 231
   ניסוח מחדש, 572 הבנת הנקרא, כולם עם התשובה הרשמית — מה באמת מנבא את
   התשובה הנכונה. רוב מה שמלמדים לא עמד במבחן; מה שכן, נמצא כאן עם
   המספר שלו. כל מספר בקובץ הזה נמדד על המאגר ולא נלקח משום מקום אחר.

   העיקרון: המבחן לא שואל אם אתה יודע את המילה הנכונה. הוא שואל אם אתה
   יכול לפסול שלוש. פסילה של שתיים מכפילה את הסיכוי מ-25% ל-50%,
   ושלוש היא תשובה נכונה. ולכן הדריל המרכזי כאן הוא דריל פסילה.
   ============================================================== */
'use strict';

(function () {

const A = window.AM;
const { el, esc, shuffle, toast, openStudy, closeStudy, ns, put, pref, setPref,
        bump, S } = A;

/* ---------- הממצאים ----------
   name  · הכלל
   n     · על כמה פריטים נמדד
   val   · המספר הנמדד
   kind  · works / dead
   why   · למה זה כך, ומה עושים עם זה */
const FINDINGS = [
  { part: 'ניסוח מחדש', kind: 'works', val: '85%', n: 231,
    name: 'האפשרות הקצרה ביותר כמעט אף פעם לא נכונה',
    why: 'ב-197 מתוך 231 הפריטים התשובה הנכונה לא הייתה הקצרה ביותר. ניסוח מחדש ' +
         'חייב לשאת את כל המידע של המשפט המקורי; אפשרות קצרה מדי השמיטה משהו. ' +
         'זו פסילה אחת חינם, לפני שקראת מילה.' },
  { part: 'ניסוח מחדש', kind: 'works', val: '92%', n: 39,
    name: 'אפשרות שקצרה ב-30% מהמשפט המקורי — פסולה',
    why: 'כשיש אפשרות אחת בודדת שאורכה פחות מ-70% מהמשפט בשאלה, ב-36 מתוך 39 ' +
         'המקרים היא לא הייתה התשובה. זה החיתוך החד ביותר שמצאתי בכל המאגר.' },
  { part: 'ניסוח מחדש', kind: 'works', val: '81%', n: 145,
    name: 'האפשרות שמעתיקה הכי הרבה מהמילים הקשות של המשפט — פסולה',
    why: 'ניסוח מחדש הוא ניסוח *מחדש*. האפשרות שמחזירה לך את אותן מילים ארוכות ' +
         'מהמשפט המקורי היא בדרך כלל המלכודת — היא נראית מוכרת בלי לומר את אותו דבר. ' +
         'התשובה הנכונה דווקא מכניסה מילים חדשות.' },
  { part: 'הבנת הנקרא', kind: 'works', val: '61%', n: 572,
    name: 'רוב השאלות אומרות לך באיזו פסקה לקרוא',
    why: '351 מתוך 572 השאלות נוקבות בפסקה במפורש ("in the second paragraph"). ' +
         'הפסקה שמצוינת היא 29% מאורך הקטע ומכילה 82% מהראיות לתשובה. ' +
         '<b>שים לב למה זה לא אומר:</b> מדדתי גם את האיחוד — על פני חמש השאלות ' +
         'של קטע, הפסקאות שהן מציינות מכסות 78% מהטקסט. כלומר זה לא חוסך קריאה. ' +
         'מה שזה כן עושה: משנה את המשימה מ"להבין את הקטע" ל"לאתר עובדה", ' +
         'ואת זה אפשר לעשות עם אוצר מילים חלקי. קרא את השאלה קודם, ותמיד תדע ' +
         'מראש מה אתה מחפש ואיפה.' },
  { part: 'הבנת הנקרא', kind: 'works', val: '86%', n: 64,
    name: 'בשאלת NOT — אל תבחר את האפשרות שנשמעת הכי זרה לקטע',
    why: 'בשאלות "which cannot be understood" הרפלקס הוא לבחור את האפשרות שהכי ' +
         'לא קשורה. מדדתי: ב-55 מתוך 64 היא לא הייתה התשובה. מאל"ו בונה את ' +
         'התשובה הנכונה דווקא ממילים של הקטע, מסודרות מחדש כדי לומר משהו שהקטע ' +
         'לא אמר. הזרה היא הפיתיון.' },
  { part: 'הכול', kind: 'works', val: '75%', n: null,
    name: 'ידיעת שתיים מארבע המילים שווה 75% הצלחה',
    why: 'לא צריך לדעת את התשובה. צריך לדעת מספיק כדי לפסול. אם אתה מכיר שתיים ' +
         'מארבע האפשרויות — או שאחת מהן היא התשובה (ואז פתרת), או ששתיהן לא ' +
         'מתאימות (ואז נשארו שתיים). התוחלת: 75%. זו הסיבה שהיכרות רדודה עם ' +
         'הרבה מילים שווה יותר מהיכרות עמוקה עם מעט.' },

  { part: 'השלמת משפטים', kind: 'dead', val: 'אפס', n: 464,
    name: 'פסילה לפי חלק דיבר לא עובדת',
    why: 'בדקתי את כל 62 הפריטים שבהם החסר בא אחרי תווית יידוע — מקום שמחייב שם ' +
         'עצם. מאל"ו לא נתנה שם אפילו הסחה אחת בחלק דיבר אחר. ארבע האפשרויות תמיד ' +
         'מאותו סוג. זמן שמושקע בזה הוא זמן אבוד.' },
  { part: 'השלמת משפטים', kind: 'dead', val: '0/29', n: 29,
    name: 'הכלל של a/an לא נותן כלום',
    why: '29 פריטים שבהם החסר בא אחרי a או an. באף אחד מהם זה לא פסל אפילו ' +
         'אפשרות אחת — מאל"ו כותבת את השאלה כך שזה לא יקרה.' },
  { part: 'השלמת משפטים', kind: 'dead', val: '25.0%', n: 464,
    name: 'אורך המילה לא מנבא כלום',
    why: 'בחירת המילה הארוכה ביותר: 25.0%. הקצרה ביותר: 25.0%. בדיוק ניחוש. ' +
         'גם "המילה שנראית נדירה" נבדקה מול תדירות אמיתית בקורפוס — היא נראתה ' +
         'מבטיחה עד שבדקתי אותה על מבחנים שלא השתתפו בחישוב, ואז היא קרסה לניחוש. ' +
         'להשלמת משפטים אין קיצור דרך. יש רק מילים.' },
  { part: 'ניסוח מחדש', kind: 'dead', val: '13% מול 10%', n: 231,
    name: 'מילים מוחלטות (all, only, never) אינן סימן להסחה',
    why: 'זה הכלל שהכי מלמדים. במאגר: מילה מוחלטת שלא הופיעה במשפט המקורי הופיעה ' +
         'ב-13.0% מהתשובות הנכונות ו-10.2% מההסחות. כלומר היא קצת יותר נפוצה ' +
         'בתשובה הנכונה. לפסול לפיה זה להזיק לעצמך.' },
  { part: 'הכול', kind: 'dead', val: 'אחיד', n: 1267,
    name: 'אין מיקום מועדף לתשובה',
    why: 'התפלגות התשובות על פני 1,267 פריטים: 24.9% / 25.2% / 21.9% / 28.0%. ' +
         '"כשלא יודעים לבחור ג\'" הוא סיפור. בחר מה שבא — רק אל תשאיר ריק.' },
  { part: 'הבנת הנקרא', kind: 'dead', val: '24%', n: 572,
    name: 'לא ניתן לזהות את התשובה לפי חפיפת מילים עם הקטע',
    why: 'ניסיתי את שני הכיוונים — האפשרות שהכי חופפת לקטע והכי פחות חופפת. ' +
         '24.1% ו-26.2%. הבנת הנקרא באמת דורשת לקרוא, אבל רק את הפסקה הנכונה.' },
];

/* ---------- מדדי הפסילה ----------
   שלושה מספרים, וכל אחד אומר משהו אחר:
   rej   · כמה פסילות סימנת
   good  · כמה מהן היו נכונות
   fatal · כמה פעמים פסלת את התשובה הנכונה — הנתון היחיד שיכול להוריד ציון */
const stats = () => Object.assign({ n: 0, hit: 0, rej: 0, good: 0, fatal: 0, saved: 0 },
                                  pref('elim', {}));
function record(p) {
  const s = stats();
  for (const k in p) s[k] = (s[k] || 0) + p[k];
  setPref('elim', s);
}
const pct = (a, b) => (b ? Math.round(100 * a / b) : 0);

/* ============================================================
   דריל הפסילה
   ============================================================
   שני שלבים בכוונה. בשלב א' אסור לבחור — רק לפסול, וזה מכריח את
   המחשבה הנכונה: "מה אני יכול לשלול", ולא "מה נראה לי". בשלב ב'
   בוחרים מתוך מה שנשאר, והמסך מראה בכמה שיפרת את הסיכוי.  */

let E = null;
const KINDS = {
  sc: { title: 'השלמת משפטים' },
  rs: { title: 'ניסוח מחדש'   },
};

async function startElim(kind, count) {
  const rows = await A.bank(kind);
  if (!rows || !rows.length) { toast('בנק השאלות לא נטען — התחבר קודם'); return; }
  E = {
    kind, items: shuffle(rows.slice()).slice(0, count),
    i: 0, out: new Set(), phase: 'cut', pick: null,
    n: 0, hit: 0, rej: 0, good: 0, fatal: 0,
  };
  paintElim();
}

const odds = (outN) => Math.round(100 / (4 - outN));

function paintElim() {
  const it = E.items[E.i], K = KINDS[E.kind];
  const c = el('div', 'card');
  const mid = el('div', 'mid');
  const cut = E.phase === 'cut';

  mid.innerHTML =
    '<span class="eyebrow">פסילה · ' + esc(K.title) + ' · ' + (E.i + 1) + ' מתוך ' + E.items.length + '</span>' +
    '<div class="ex" style="font-size:var(--fs-lg)">' +
      (E.kind === 'sc' ? A.examSentence(it.stem) : esc(it.stem)) + '</div>';

  if (E.phase !== 'done') {
    const lead = el('div', 'note');
    lead.style.cssText = 'text-align:center;max-width:46ch';
    lead.innerHTML = cut
      ? 'סמן כל אפשרות שאתה <b>יכול לשלול</b>. לא מה שנראה נכון — מה שבטוח לא.'
      : 'עכשיו בחר מתוך מה שנשאר.';
    mid.appendChild(lead);
  }

  const box = el('div', 'opts');
  it.options.forEach((o, k) => {
    const isOut = E.out.has(k);
    let cls = 'opt';
    if (E.phase === 'done') {
      if (k === it.answer) cls += ' right';
      else if (k === E.pick) cls += ' wrong';
      if (isOut) cls += ' struck';
    } else {
      if (isOut) cls += ' struck';
      if (!cut && k === E.pick) cls += ' pick';
    }
    const b = el('button', cls, '<span class="num">(' + (k + 1) + ')</span>' + esc(o));
    if (E.phase === 'done') b.disabled = true;
    else b.onclick = () => {
      if (cut) { E.out.has(k) ? E.out.delete(k) : (E.out.size < 3 && E.out.add(k)); }
      else if (!E.out.has(k)) { E.pick = k; commit(); return; }
      else { toast('פסלת את זו. בטל את הפסילה קודם.'); return; }
      paintElim();
    };
    box.appendChild(b);
  });
  mid.appendChild(box);

  /* מד הסיכוי — הוא כל הרעיון, ולכן הוא על המסך כל הזמן */
  if (E.phase !== 'done') {
    const m = el('div', 'oddsbar');
    m.innerHTML =
      '<div class="lab">הסיכוי שלך עכשיו</div>' +
      '<div class="val rng">' + odds(E.out.size) + '%</div>' +
      '<div class="steps">' + [0, 1, 2, 3].map((n) =>
        '<i class="' + (n <= E.out.size ? 'on' : '') + '">' + odds(n) + '%</i>').join('') + '</div>';
    mid.appendChild(m);
  }

  if (E.phase === 'done') mid.appendChild(explain(it));

  const acts = el('div', 'acts');
  if (cut) {
    const go = el('button', 'btn',
      !E.out.size ? 'אני לא יכול לפסול כלום'
      : E.out.size === 1 ? 'נעל פסילה אחת ובחר'
      : 'נעל ' + E.out.size + ' פסילות ובחר');
    go.onclick = () => { E.phase = 'pick'; paintElim(); };
    acts.appendChild(go);
  } else if (E.phase === 'done') {
    const nx = el('button', 'btn', E.i + 1 < E.items.length ? 'הבא' : 'סיום');
    nx.onclick = next;
    acts.appendChild(nx);
  }
  c.append(mid, acts);
  const box2 = openStudy(c, { i: E.i, n: E.items.length, right: E.hit + '/' + E.n, close: () => { E = null; A.render(); } });
  box2.className = 'study m-elim';
}

function commit() {
  const it = E.items[E.i];
  const right = E.pick === it.answer;
  const fatal = E.out.has(it.answer);
  const good = [...E.out].filter((k) => k !== it.answer).length;
  E.phase = 'done'; E.n++; E.hit += right ? 1 : 0;
  E.rej += E.out.size; E.good += good; E.fatal += fatal ? 1 : 0;
  record({ n: 1, hit: right ? 1 : 0, rej: E.out.size, good, fatal: fatal ? 1 : 0 });
  put('attempt', it.kind + ':' + it.exam + ':' + it.sec + ':' + it.n,
      { c: E.pick, ok: right ? 1 : 0, cut: [...E.out], at: Date.now() });
  bump({ ex: 1, exok: right ? 1 : 0 });
  paintElim();
}

function next() {
  if (E.i + 1 >= E.items.length) return finishElim();
  E.i++; E.out = new Set(); E.phase = 'cut'; E.pick = null;
  paintElim();
}

/* ---------- ההסבר: מה הפסילות שלך עשו ---------- */
function gloss(word) {
  const o = S.words.get(String(word).toLowerCase().trim());
  if (!o || !(o.def || o.he)) return '<div class="gl dim">—</div>';
  return '<div class="gl">' + (o.def ? esc(o.def) : '') +
    (o.he ? ' — <b>' + esc(o.he) + '</b>' : '') + '</div>';
}
function explain(it) {
  const w = el('div', 'why');
  const fatal = E.out.has(it.answer);
  let h = '';

  h += '<h4>' + (fatal ? 'פסלת את התשובה הנכונה' : 'הפסילות שלך') + '</h4>';
  if (fatal) {
    h += '<p class="note">זו הטעות היקרה. פסילה שגויה לא מורידה סיכוי — היא מאפסת אותו. ' +
         'הכלל: פסול רק כשאתה יודע <b>למה</b> האפשרות לא מתאימה, לא כשהיא סתם לא מוכרת.</p>';
  } else if (E.out.size) {
    h += '<p class="note">' + (E.out.size === 1 ? 'הפסילה שלך הייתה נכונה'
                              : 'כל ' + E.out.size + ' הפסילות היו נכונות') +
         '. הסיכוי שלך עלה מ-25% ל-' + odds(E.out.size) + '%' +
         (E.pick === it.answer ? ', והתשובה נפלה.' : '.') + '</p>';
  } else {
    h += '<p class="note">לא פסלת כלום, ולכן ניחשת מתוך ארבע. גם פסילה אחת בטוחה שווה ' +
         'שמונה נקודות אחוז.</p>';
  }

  if (it.kind === 'sc' && it.full) {
    h += '<h4>המשפט השלם</h4><div class="ex">' +
      A.highlightWord(it.full, it.options[it.answer]) + '</div>';
  }
  h += '<h4>ארבע האפשרויות</h4>';
  it.options.forEach((o, k) => {
    const cls = k === it.answer ? 'ok' : E.out.has(k) ? 'dim' : 'no';
    const mk = k === it.answer ? '✓' : E.out.has(k) ? '⊘' : '·';
    h += '<div class="opt-row ' + cls + '"><div class="mk">' + mk + '</div><div>' +
      '<div class="en">' + esc(o) + '</div>' +
      (it.kind === 'sc' ? gloss(o) : '') + '</div></div>';
  });

  /* הכלל הנמדד שהיה עוזר כאן — רק כשהוא באמת חל על הפריט הזה */
  const tip = ruleFor(it);
  if (tip) h += '<h4>הכלל שחל כאן</h4><p class="note">' + tip + '</p>';

  w.innerHTML = h;
  return w;
}

function ruleFor(it) {
  if (it.kind !== 'rs') return null;
  const L = it.options.map((o) => o.length);
  const shortest = L.indexOf(Math.min(...L));
  const tiny = it.options.filter((o) => o.length < 0.70 * it.stem.length);
  if (tiny.length === 1) {
    const i = it.options.indexOf(tiny[0]);
    return 'אפשרות (' + (i + 1) + ') קצרה ב-30% מהמשפט המקורי. ' +
      'ב-92% מהמקרים כאלה במאגר היא לא התשובה' +
      (i === it.answer ? ' — הפריט הזה הוא אחד ה-8% הנותרים. הכלל מטה, לא מוכיח.'
                       : ', וגם כאן לא. פסילה חינם.') + '';
  }
  return 'האפשרות הקצרה ביותר כאן היא (' + (shortest + 1) + '). במאגר היא לא התשובה ' +
    'ב-85% מהפריטים' + (shortest === it.answer ? ' — כאן היא כן הייתה. זה קורה באחד משבעה.'
                                               : '. פסילה חינם.') + '';
}

function finishElim() {
  const c = el('div', 'card'), mid = el('div', 'mid');
  const acc = pct(E.good, E.rej);
  mid.innerHTML =
    '<span class="eyebrow">סיכום</span>' +
    '<div class="big">' + E.hit + '/' + E.n + '</div>' +
    '<div class="note" style="text-align:center;max-width:44ch">' +
      'דיוק הפסילה שלך: <b>' + acc + '%</b> מתוך ' + A.plural(E.rej, 'פסילה אחת', 'פסילות') + '.' +
      (E.fatal ? ' פסלת את התשובה הנכונה <b>' + E.fatal + '</b> פעמים.' : ' לא פסלת אף תשובה נכונה.') +
      '<br><br>' + verdict(acc, E.fatal, E.rej) + '</div>';
  const acts = el('div', 'acts');
  const b = el('button', 'btn', 'סיום');
  b.onclick = () => { E = null; closeStudy(); A.render(); };
  acts.appendChild(b);
  c.append(mid, acts);
  openStudy(c, { i: E.n, n: E.n, right: E.hit + '/' + E.n, close: () => { E = null; A.render(); } });
}

function verdict(acc, fatal, rej) {
  if (!rej) return 'לא פסלת כלום. הדריל הזה עובד רק אם מנסים — פסילה שגויה כאן עולה כלום.';
  if (fatal === 0 && acc === 100) return 'פסילה מושלמת. אתה יכול להרשות לעצמך לפסול יותר אגרסיבית במבחן.';
  if (acc >= 90) return 'פסילה מדויקת. סמוך עליה במבחן.';
  if (acc >= 75) return 'פסילה סבירה. עדיין מרוויח ממנה — אבל בדוק את המילים שהפילו אותך.';
  return 'הפסילה שלך מנחשת. ברמה הזו עדיף לפסול רק כשאתה יכול לנסח למה. חזור לאוצר המילים.';
}

/* ============================================================
   קריאה ממוקדת
   ============================================================
   61% משאלות הבנת הנקרא נוקבות בפסקה. הפסקה שצוינה מחזיקה 82% מהראיות
   והיא 29% מהטקסט. הדריל מכריח את הסדר הנכון: שאלה, פסקה, תשובה —
   והקטע המלא נפתח רק אם ביקשת, ונרשם שביקשת. */

const ORDW = { first: 0, second: 1, third: 2, fourth: 3, fifth: 4 };
const paras = (t) => t.split(/\n{2,}/).map((x) => x.trim()).filter((x) => x.length > 40);
function scopeOf(text, stem) {
  const m = stem.match(/(first|second|third|fourth|fifth|last) paragraph/i);
  const P = paras(text);
  if (!m || P.length < 2) return null;
  const k = m[1].toLowerCase();
  const i = k === 'last' ? P.length - 1 : ORDW[k];
  return i == null || i >= P.length ? null : { i, text: P[i], all: P };
}

let R = null;
async function startFocus() {
  const [rows, ps] = await Promise.all([A.bank('rc'), A.bank('passage')]);
  if (!rows || !ps || !rows.length) { toast('בנק השאלות לא נטען — התחבר קודם'); return; }
  const byId = new Map(ps.map((p) => [p.id, p]));
  const pool = rows.filter((r) => {
    const p = byId.get(r.passage);
    return p && scopeOf(p.text, r.stem);
  });
  if (!pool.length) { toast('אין פריטים מתאימים'); return; }
  R = { items: shuffle(pool).slice(0, 6), by: byId, i: 0, n: 0, hit: 0, opened: 0, pick: null, full: false };
  paintFocus();
}

function paintFocus() {
  const it = R.items[R.i], p = R.by.get(it.passage), sc = scopeOf(p.text, it.stem);
  const done = R.pick != null;
  const c = el('div', 'card'), mid = el('div', 'mid');
  mid.innerHTML =
    '<span class="eyebrow">קריאה ממוקדת · ' + (R.i + 1) + ' מתוך ' + R.items.length + '</span>' +
    '<div class="ex" style="font-size:var(--fs-md)">' + esc(it.stem) + '</div>';

  const pass = el('div', 'passage focus');
  pass.innerHTML = '<div class="plab">הפסקה שהשאלה מפנה אליה — ' +
    Math.round(100 * sc.text.length / p.text.length) + '% מהקטע</div>' +
    A.passageHTML(sc.text);
  mid.appendChild(pass);

  if (R.full) {
    const rest = el('div', 'passage');
    rest.innerHTML = '<div class="plab dim">שאר הקטע</div>' +
      sc.all.map((t, k) => k === sc.i ? '' : A.passageHTML(t)).join('');
    mid.appendChild(rest);
  }

  const box = el('div', 'opts');
  it.options.forEach((o, k) => {
    let cls = 'opt';
    if (done) { if (k === it.answer) cls += ' right'; else if (k === R.pick) cls += ' wrong'; }
    const b = el('button', cls, '<span class="num">(' + (k + 1) + ')</span>' + esc(o));
    if (done) b.disabled = true;
    else b.onclick = () => {
      R.pick = k; R.n++; R.hit += k === it.answer ? 1 : 0;
      put('attempt', it.kind + ':' + it.exam + ':' + it.sec + ':' + it.n,
          { c: k, ok: k === it.answer ? 1 : 0, at: Date.now() });
      bump({ ex: 1, exok: k === it.answer ? 1 : 0 });
      paintFocus();
    };
    box.appendChild(b);
  });
  mid.appendChild(box);

  if (done) {
    const w = el('div', 'why');
    w.innerHTML = '<h4>' + (R.pick === it.answer ? 'נכון' : 'התשובה: (' + (it.answer + 1) + ')') + '</h4>' +
      '<p class="note">' + (R.full
        ? 'פתחת את הקטע המלא. ב-82% מהמקרים כל הראיות כבר היו בפסקה — נסה בפעם הבאה ' +
          'להחליט ממנה, ולפתוח רק אם באמת נתקעת.'
        : 'ענית מהפסקה בלבד — ' + Math.round(100 * sc.text.length / p.text.length) +
          '% מהקטע. במבחן תקרא בסוף את רובו בכל מקרה, אבל תמיד עם שאלה ביד ' +
          'ובלי לנסות להחזיק את הכול בראש.') + '</p>';
    mid.appendChild(w);
  }

  const acts = el('div', 'acts');
  if (!done && !R.full) {
    const o = el('button', 'btn ghost', 'פתח את הקטע המלא');
    o.onclick = () => { R.full = true; R.opened++; paintFocus(); };
    acts.appendChild(o);
  }
  if (done) {
    const nx = el('button', 'btn', R.i + 1 < R.items.length ? 'הבא' : 'סיום');
    nx.onclick = () => {
      if (R.i + 1 >= R.items.length) { const h = R.hit, n = R.n, op = R.opened; R = null; closeStudy(); A.render();
        toast(h + '/' + n + ' · פתחת את הקטע המלא ' + A.plural(op, 'פעם אחת', 'פעמים')); return; }
      R.i++; R.pick = null; R.full = false; paintFocus();
    };
    acts.appendChild(nx);
  }
  c.append(mid, acts);
  const b = openStudy(c, { i: R.i, n: R.items.length, right: R.hit + '/' + R.n, close: () => { R = null; A.render(); } });
  b.className = 'study m-read';
}

/* ============================================================
   המסך
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

function view(v) {
  const signed = !!(window.Cloud && window.Cloud.user);

  /* ---- הפתיח: המספר שמחליף את "ללמוד 1500 מילים" ---- */
  const head = el('div', 'sec');
  head.appendChild(el('span', 'eyebrow', 'אסטרטגיה'));
  head.appendChild(el('p', 'note',
    'המבחן לא בודק כמה מילים אתה יודע — הוא בודק כמה תשובות אתה יכול לפסול. ' +
    'ידיעה של שתיים מארבע האפשרויות, בלי לדעת מי הנכונה, שווה <b>75%</b> הצלחה.'));
  const lad = el('div', 'ladder');
  [[0, '25%', 'ניחוש מלא'], [1, '33%', 'פסילה אחת'], [2, '50%', 'שתי פסילות'], [3, '100%', 'שלוש']]
    .forEach(([n, p, t]) => {
      lad.innerHTML += '<div class="rung"><b>' + p + '</b><span>' + t + '</span></div>';
    });
  head.appendChild(lad);
  v.appendChild(head);

  if (!signed) v.appendChild(el('div', 'note', 'בנק השאלות דורש התחברות — הכפתור למעלה מימין.'));

  /* ---- הדרילים ---- */
  const dr = el('div', 'sec');
  dr.appendChild(el('span', 'eyebrow', 'לאמן את הפסילה'));
  tile(dr, 'דריל פסילה — השלמת משפטים', 'לפסול לפני שבוחרים. 12 מתוך 23 השאלות — 52% מהניקוד.',
    () => startElim('sc', 8), 'הליבה');
  tile(dr, 'דריל פסילה — ניסוח מחדש', 'כאן שני כללים נמדדים חותכים אפשרות עוד לפני הקריאה.',
    () => startElim('rs', 6));
  tile(dr, 'קריאה ממוקדת', 'שאלה קודם, ואז הפסקה שהיא מציינת. לאתר במקום להבין.',
    startFocus, '29% לשאלה');
  v.appendChild(dr);

  /* ---- דיוק הפסילה שלך ---- */
  const s = stats();
  if (s.n) {
    const st = el('div', 'sec');
    st.appendChild(el('span', 'eyebrow', 'דיוק הפסילה שלך'));
    const g = el('div', 'statgrid');
    const acc = pct(s.good, s.rej);
    [['דיוק פסילה', acc + '%', A.plural(s.rej, 'פסילה אחת', 'פסילות')],
     ['פסילות קטלניות', String(s.fatal), 'פעמים שפסלת את הנכונה'],
     ['הצלחה', pct(s.hit, s.n) + '%', s.n + ' פריטים'],
     ['פסילות לפריט', (s.rej / s.n).toFixed(1), 'ממוצע']]
      .forEach(([lab, val, sub]) => {
        g.innerHTML += '<div class="stat"><div class="v">' + esc(val) + '</div>' +
          '<div class="l">' + esc(lab) + '</div><div class="s">' + esc(sub) + '</div></div>';
      });
    st.appendChild(g);
    st.appendChild(el('p', 'note', verdict(acc, s.fatal, s.rej)));
    v.appendChild(st);
  }

  /* ---- הממצאים ---- */
  const f = el('div', 'sec');
  f.appendChild(el('span', 'eyebrow', 'מה נמדד על 1,267 שאלות אמיתיות'));
  f.appendChild(el('p', 'note',
    'כל שורה כאן נבדקה על 58 פרקי אנגלית מ-29 מבחני עבר, עם התשובות הרשמיות. ' +
    'הירוקות עובדות. האדומות הן מה שמלמדים ולא עמד בבדיקה — הן חוסכות לך זמן דווקא בגלל שהן שם.'));
  ['works', 'dead'].forEach((kind) => {
    FINDINGS.filter((x) => x.kind === kind).forEach((x) => {
      const d = el('details', 'finding ' + kind);
      d.innerHTML = '<summary><span class="fv">' + esc(x.val) + '</span>' +
        '<span class="fn">' + esc(x.name) + '</span>' +
        '<span class="fp">' + esc(x.part) + '</span></summary>' +
        '<p>' + x.why + '</p>';
      f.appendChild(d);
    });
  });
  v.appendChild(f);

  /* ---- הפער ---- */
  const gap = el('div', 'sec');
  gap.appendChild(el('span', 'eyebrow', 'הפער'));
  gap.appendChild(el('p', 'note',
    'לפי טבלת ההמרה הרשמית, 120 הוא ציון גולמי של כ-31.5 מתוך 44 ו-134 הוא כ-37.5. ' +
    'הפרש של <b>שש תשובות</b> על סולם של 44 — ובאמירנט, שסופר 23 שאלות, ' +
    'זה <b>שלוש תשובות נוספות</b>. שלוש. זה כל המרחק בין 120 לפטור, ' +
    'וזה בדיוק הטווח שפסילה מסודרת מייצרת בלי מילה חדשה אחת.'));
  v.appendChild(gap);
}

window.AMStrat = { view, elim: startElim, focus: startFocus, ruleFor };

})();
