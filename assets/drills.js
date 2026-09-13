/* ================= אמירנט — תרגול בפורמט המבחן =================

   ארבעה דרילים, אחד לכל מקור נקודות לפי משקלו. הבחינה סופרת 23 שאלות
   (4+4 השלמת משפטים · 5 הבנת הנקרא · 3+3 ניסוח מחדש · 4 השלמת משפטים):
   השלמת משפטים 12/23, ניסוח מחדש 6/23, הבנת הנקרא 5/23.

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

/* ההבדל בין המקור לכל אפשרות, מסומן מילה-מילה. במקור זה נכתב כאילו
   הסימון חושף את המסיח; המדידה הפריכה את זה — התשובה הנכונה מכניסה
   יותר מילים חדשות מהמסיח (4.96 מול 4.34 בממוצע). הסימון נשאר כי הוא
   מראה איפה כל אפשרות נפרדת מהמקור, אבל הוא כלי השוואה ולא מחוון. */
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

  /* ההסבר הקודם כאן טען שהמסיח הוא זה ש"מוסיף מה שלא נאמר". מדדתי, וזה
     הפוך: התשובה הנכונה מכניסה בממוצע 4.96 מילות תוכן חדשות מול 4.34
     במסיח, והיא בעלת המספר הגבוה ביותר ב-45.5% מהפריטים — כמעט כפול
     מהמקרה. ניסוח מחדש הוא בהגדרה ניסוח באחרות, ולכן "נשמע אחרת" הוא
     סימן לפרפרזה אמיתית ולא למלכודת. */
  let h = '<h4>מה כל אפשרות מנסחת אחרת</h4>' +
    '<div class="note">מסומן מה שאין במשפט המקורי. <b>שים לב שהתשובה הנכונה ' +
    'בדרך כלל מסומנת הכי הרבה</b> — היא בעלת מספר המילים החדשות הגבוה ביותר ' +
    'ב-45.5% מהפריטים במאגר, לעומת 25% במקרה. "היא אומרת את זה במילים אחרות" ' +
    'הוא לא נימוק לפסילה; זו בדיוק העבודה של ניסוח מחדש.</div>';

  it.options.forEach((o, k) => {
    const mark = k === it.answer ? '✓' : (k === chosen ? '✗' : (k + 1));
    const cls = k === it.answer ? 'ok' : k === chosen ? 'no' : 'dim';
    h += '<div class="opt-row ' + cls + '"><div class="mk">' + mark + '</div>' +
      '<div class="en diff" style="font-size:var(--fs-base)">' + diffAgainst(it.stem, o) + '</div></div>';
  });

  h += '<h4>מה כן מכריע</h4>' +
    '<div class="note">שאלה אחת: האם האפשרות נושאת את <b>אותה עובדה</b> — מי, ' +
    'עשה מה, למי, מתי. מסיח משנה פרט אחד בשלד הזה, לא את אוצר המילים.</div>';

  const tip = window.AMStrat && window.AMStrat.ruleFor(Object.assign({ kind: 'rs' }, it));
  if (tip) h += '<h4>הכלל הנמדד שחל כאן</h4><div class="note">' + tip + '</div>';

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
  purpose_para: 'קרא רק את משפט הפתיחה של אותה פסקה. זו התבנית השנייה בשכיחות, והתשובה כמעט תמיד שם.',
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

const itemId = (r) => r.kind + ':' + r.exam + ':' + r.sec + ':' + r.n;

/* לוח הקטע בקטע המלא. הפונקציה הזאת נקראה מ-paintRC אבל מעולם לא
   הוגדרה — כלומר "קטע מלא" זרק ReferenceError בשאלה הראשונה, תמיד.
   מכאן ואילך: הקטע פתוח בשאלה הראשונה ומקופל אחריה, כי אחרי שקראת
   אותו פעם אחת הוא רק דוחף את השאלה מתחת לקפל. */
function passagePanel(text, folded) {
  const box = el('div', 'passage' + (folded ? ' folded' : ''));
  box.innerHTML = text.split(/\n{2,}/)
    .map((t) => '<p>' + esc(t.trim()) + '</p>').join('');
  const tog = el('button', 'hint', folded ? 'פתח את הקטע' : 'קפל');
  tog.onclick = () => {
    const on = box.classList.toggle('folded');
    tog.textContent = on ? 'פתח את הקטע' : 'קפל';
  };
  const wrap = el('div');
  wrap.style.cssText = 'width:100%;max-width:48ch';
  wrap.append(box, tog);
  return wrap;
}

/* מנוע הפרקים עבר ל-exam.js. הוא היה כאן בגרסה שהכירה סוג פרק אחד;
   עכשיו הוא מגיש את שלושת הסוגים, סימולציה מלאה ורצף פרקים, ואין טעם
   בשתי מימושים לאותו דבר. */

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
   בוחרים נכון, ואז מתייגים למה כל מסיח שגוי.

   התיוג הוא שלך ולא שלי, וזה מכוון. בניתי חמישה מזהים אוטומטיים
   לטקסונומיה הזאת ומדדתי אותם על 693 המסיחים: כולם נורים על התשובה
   הנכונה באותו שיעור כמו על המסיח (יחס 0.63 עד 1.00). כלומר אי אפשר
   לזהות את סוג המלכודת מהמאפיינים הגלויים, ותווית שהייתי מדביק כאן
   הייתה מלמדת רעש בביטחון מלא. מה שכן עובד הוא שתנסח בעצמך למה
   המסיח שגוי — העיבוד הזה הוא הלימוד, והתוויות שלך מרכיבות את מפת
   המלכודות במסך ההתקדמות.
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
/* הפסקה שהשאלה מדברת עליה. הקטעים נושאים עכשיו גבולות פסקה אמיתיים
   (\n\n) שחולצו מה-PDF; בגרסה הקודמת החלוקה נעשתה לפי הסוגריים שבטקסט,
   שהם **מספרי שורה** ולא סימני פסקה, ולכן כל פריט בספרינט הציג חלון
   טקסט שמתחיל באמצע משפט. */
const ORD = { first: 0, second: 1, third: 2, fourth: 3, fifth: 4 };
function paras(text) {
  return text.split(/\n{2,}/).map((x) => x.trim()).filter((x) => x.length > 40);
}
function paraOf(text, stem) {
  const m = stem.match(/(first|second|third|fourth|fifth|last) paragraph/i);
  const parts = paras(text);
  if (!m || parts.length < 2) return null;
  const key = m[1].toLowerCase();
  const i = key === 'last' ? parts.length - 1 : ORD[key];
  return i == null || i >= parts.length ? null : parts[i];
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
    const para = paraOf(p.text, q.stem);
    const box = el('div', 'passage focus');
    box.innerHTML = (para
      ? '<div class="plab">הפסקה שהשאלה מפנה אליה — ' +
        Math.round(100 * para.length / p.text.length) + '% מהקטע</div><p>' + esc(para) + '</p>'
      : p.text.split(/\n{2,}/).map((t) => '<p>' + esc(t.trim()) + '</p>').join(''));
    mid.appendChild(box);
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
    /* הסיבוב הבא נדחה, ולכן חייב להיות ניתן לביטול: סגירת המשטח מאפסת
       את TW, והקריאה הדחויה הייתה נוגעת ב-null, זורקת, ופותחת מחדש
       משטח שהמשתמש כבר סגר. */
    clearTimeout(TW._d);
    TW._d = setTimeout(() => { if (TW) towerRound(); }, right ? 260 : 900);
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
  openMode(c, { i: 1, n: 1, right: 'שיא ' + TW.best, close: () => { clearInterval(TW._t); clearTimeout(TW._d); TW = null; A.render(); } }, 'tower');
  const t0 = Date.now();
  clearInterval(TW._t);
  TW._t = setInterval(() => {
    if (!TW) return clearInterval(TW._t);
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
  /* אותה מילה מופיעה ביותר מזוג אחד ב-pairs.json. אם שני זוגות בחפיסה
     חולקים מילה, נוצרים שני כרטיסים זהים והחפיסה בלתי פתירה — מדדתי
     שזה קרה בכ-10% מהחלוקות. הבחירה כאן חוסמת חזרה על מילה. */
  const used = new Set(), pick = [];
  for (const p of shuffle(have.slice())) {
    if (pick.length >= 4) break;
    if (used.has(p[0]) || used.has(p[1])) continue;
    used.add(p[0]); used.add(p[1]); pick.push(p);
  }
  if (pick.length < 3) { toast('עוד אין מספיק זוגות נפרדים'); return; }
  const cards = [];
  pick.forEach(([a, b]) => {
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
  openMode(c, { i: done, n: PR.pairsN, right: '', close: () => { clearTimeout(PR._d); PR = null; A.render(); } }, 'pair');
}
function flip(i) {
  PR.open.push(i);
  if (PR.open.length === 2) {
    PR.moves++;
    const [a, b] = PR.open.map((k) => PR.cards[k]);
    if (a.g === b.g && a.kind !== b.kind) { PR.matched[a.g] = 1; PR.open = []; }
    else {
      clearTimeout(PR._d);
      PR._d = setTimeout(() => { if (!PR) return; PR.open = []; paintPairs(); }, 900);
    }
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
  /* פאזל יומי. הגרסה הקודמת לקחה חלון רץ — rot.slice(start, start+4) —
     כלומר שני ימים עוקבים חלקו שלוש מתוך ארבע הקבוצות. עכשיו הזרע
     מערבב את כל הרשימה ולוקח את הארבע הראשונות, כך שכל יום הוא חלוקה
     אחרת באמת. */
  let seed = 0;
  for (const ch of today()) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  const rot = ok.slice();
  for (let i = rot.length - 1; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0;
    [rot[i], rot[j]] = [rot[j], rot[i]];
  }
  /* מילה שחוזרת בשתי קבוצות הופכת את הפאזל לבלתי פתיר חד-משמעית. */
  const pick = [], taken = new Set();
  for (const g of rot) {
    if (pick.length >= 4) break;
    if (g.words.some((w) => taken.has(w))) continue;
    g.words.forEach((w) => taken.add(w));
    pick.push(g);
  }
  if (pick.length < 4) { toast('חבילת הרביעיות עוד לא מוכנה'); return; }
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
  /* רק מילים שיש מה להציג להן. בלי הסינון הזה הבליץ היה מבקש שיפוט
     על מילה בלי הגדרה, וכותב על סמך זה מצב FSRS — כלומר מזיז תזמון
     לפי ניחוש עיוור. */
  const has = (w) => { const o = S.words.get(w); return o && (o.def || o.he); };
  const due = A.dueList().filter(has);
  const pool = (due.length ? due : A.newList().filter(has).slice(0, 40)).slice(0, 60);
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
      '';
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

/* ---------- מסך התבניות ----------
   RECIPE ישב בקוד מהיום הראשון ונשלף רק בתוך דריל, כלומר אחרי
   שכבר ענית. תבנית נלמדת פעם אחת ונשלפת בכל שאלה — ולכן היא צריכה
   מקום שאפשר לקרוא בו מראש. */
const PATTERN_ORDER = ['detail', 'purpose_para', 'inference', 'title',
                       'purpose_text', 'vocab', 'except', 'reference'];
/* המספרים נמדדו על 572 השאלות בסיווג של rcType עצמו — אותו סיווג
   שמתייג שאלה בתוך דריל. סיווג אחר היה נותן מספרים אחרים, ושני
   סיווגים באותו מסך הם בלבול. */
const PATTERN_SHARE = {
  detail: '22%', purpose_para: '20%', inference: '12%', title: '7%',
  purpose_text: '6%', vocab: '6%', except: '5%', reference: '2%',
};
function patterns(v) {
  const head = el('div', 'sec');
  head.appendChild(el('span', 'eyebrow', 'תבניות'));
  head.appendChild(el('p', 'note',
    'שמונה התבניות ושתי המסגרות — נלמד פעם אחת, נשלף בכל שאלה. ' +
    'האחוזים נמדדו על 572 שאלות הבנת הנקרא שבמאגר; עוד 19% מהשאלות ' +
    'לא נופלות לאף תבנית מובהקת, ולשם צריך קריאה רגילה.'));
  v.appendChild(head);

  const rc = el('div', 'sec');
  rc.appendChild(el('span', 'eyebrow', 'הבנת הנקרא'));
  PATTERN_ORDER.forEach((k) => {
    const he = (RC_TYPES.find((t) => t[0] === k) || [, , k])[2];
    const d = el('details', 'finding works');
    d.innerHTML = '<summary><span class="fv">' + esc(PATTERN_SHARE[k] || '·') +
      '</span><span class="fn">' + esc(he) + '</span></summary>' +
      '<p>' + esc(RECIPE[k]) + '</p>';
    rc.appendChild(d);
  });
  v.appendChild(rc);

  const fr = el('div', 'sec');
  fr.appendChild(el('span', 'eyebrow', 'שתי המסגרות בהשלמת משפטים'));
  [['המשפט מגדיר את עצמו',
    'פסוקית, אפוזיציה, נקודתיים או "known as" אומרות מה המילה החסרה. ' +
    'כשזה קורה אין צורך להכיר את המילה — צריך רק להתאים להגדרה שכבר במשפט. ' +
    'מופיע ב-9.3% מהפריטים.'],
   ['יש כאן היפוך',
    'but · although · despite · unlike · yet. המילה החסרה חייבת להיות בקוטביות ' +
    'ההפוכה מהחצי השני של המשפט. מופיע ב-8.6% מהפריטים.']].forEach(([t, b]) => {
    const d = el('details', 'finding works');
    d.innerHTML = '<summary><span class="fv">·</span><span class="fn">' + esc(t) + '</span></summary><p>' + b + '</p>';
    fr.appendChild(d);
  });
  v.appendChild(fr);

  const warn = el('div', 'sec');
  warn.appendChild(el('p', 'note',
    '<b>ושתי המסגרות האלה מכסות 18% מהפרק בלבד.</b> ב-61% מהשאלות אין ' +
    'שום רמז מבני — רק אוצר מילים ופסילה. מדדתי את זה על כל 464 הפריטים, ' +
    'והמספר מופיע במסך האסטרטגיה.'));
  v.appendChild(warn);
}

function menu(v) {
  const signed = !!(window.Cloud && window.Cloud.user);
  v.appendChild(el('span', 'eyebrow', 'תרגולים ממוקדים'));
  v.appendChild(el('p', 'note',
    'ארבעה תרגולים שמכוונים לדפוס אחד כל אחד. פרקים שלמים בפורמט המבחן ' +
    'נמצאים תחת "פרקים".'));
  if (!signed) {
    v.appendChild(el('div', 'note', 'בנק השאלות דורש התחברות — הכפתור למעלה מימין.'));
  }
  tile(v, 'מסגרות מגלות', 'שני הדפוסים שמכריעים את השאלה כשהם נוכחים.', startFrames);
  tile(v, 'צייד המלכודות', 'ניסוח מחדש — לבחור נכון, ואז להבין למה השאר שגויים. 26% מהניקוד.',
    startTraps);
  tile(v, 'מסך התבניות', 'שמונה תבניות הבנת הנקרא ושתי המסגרות — לקרוא לפני, לא אחרי.',
    () => A.go('pat'));
  tile(v, 'ספרינט מטרת הפסקה', 'התבנית השנייה בשכיחות בהבנת הנקרא — 20% מהשאלות, והפסקה נתונה.',
    () => startRC('sprint'));
  tile(v, 'קטע מלא', 'קטע אמיתי וחמש שאלות בסדר המבחן.', () => startRC('full'));


  const pg = el('button', 'btn ghost');
  pg.style.cssText = 'text-align:right;padding:14px';
  pg.innerHTML = '<div style="font-weight:700;font-size:var(--fs-md);color:var(--text)">התקדמות</div>' +
    '<div class="tiny muted" style="font-weight:400;margin-top:2px">אומדן ציון מול 134, מגמה, ודיוק לפי פרק.</div>';
  pg.onclick = () => A.go('prog');
  v.appendChild(pg);
}

function play(v) {
  v.appendChild(el('span', 'eyebrow', 'משחקים'));
  tile(v, 'רביעיות', 'שש-עשרה מילים, ארבע קבוצות משמעות. פאזל חדש בכל יום.', startQuads);
  tile(v, 'מגדל המילים', 'זיהוי תחת שעון. המבחן נותן 60 שניות לשאלה.', startTower);
  tile(v, 'זוגות מבלבלים', 'המילים שהמבחן מציב זו לצד זו בכוונה.', startPairs);
  tile(v, 'בליץ 90', 'תשעים שניות. לתור בסופר.', startBlitz,
    pref('blitzBest', 0) ? 'שיא ' + pref('blitzBest', 0) : '');
}

/* ---------- הדפסה לשבת ופיוס ---------- */
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

window.AMDrills = {
  menu, play, patterns,
  /* משגרים למסך "היום" ולבנק הטעויות — הם מרכיבים משימה מהחלקים האלה
     ולכן צריכים לפתוח אותם ישירות, בלי לעבור דרך התפריט. */
  traps: startTraps,
  rc: (mode) => startRC(mode),
  blitz: startBlitz,
  itemId,
  reconcile,
};
if (A.S.ready) A.render();

})();
