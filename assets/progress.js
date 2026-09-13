/* ================= אמירנט — התקדמות =================

   שישה מדדים, וכל אחד עונה על שאלה אחרת. שניים מהם חדשים ושניהם
   אישיים במובן שאי אפשר לקבל אותם ממאגר:

   · מעבר ראשון מול שינוי — כשאתה חוזר לשאלה ומשנה תשובה, זה עוזר או
     מזיק? לרוב הנבחנים יש על זה דעה חזקה ואף אחד לא מדד. כאן זה נמדד.
   · מפת המלכודות — התיוגים שאתה עצמך נתת בצייד המלכודות. ניסיתי לזהות
     את סוגי המלכודות אוטומטית ונכשלתי (חמישה מזהים, יחס 0.63–1.00 בין
     מסיח לתשובה נכונה), ולכן המפה הזאת נבנית מהשיפוט שלך בלבד.
   ============================================================== */
'use strict';

(function () {

const A = window.AM;
const { el, esc, ns, pref, card, bucket, S, today, addDays, between, heDate,
        studyDaysLeft } = A;

const KIND = [['sc', 'השלמת משפטים', 12], ['rs', 'ניסוח מחדש', 6], ['rc', 'הבנת הנקרא', 5]];
const TOTALQ = 23;
const TRAP_HE = {
  added: 'עובדה שלא נאמרה', predicate: 'החלפת פרדיקט', reversal: 'היפוך כיוון',
  degree: 'הגזמה או החלשה', swap: 'החלפת מבצע', partial: 'פרט צדדי',
};

let SCALE = null;
async function scale() {
  if (SCALE) return SCALE;
  try { SCALE = (await (await fetch('./data/scale.json')).json()).scale; } catch (e) { SCALE = null; }
  return SCALE;
}
const toScale = (frac) => SCALE ? SCALE[Math.max(0, Math.min(44, Math.round(frac * 44)))] : null;

function split() {
  const at = ns('attempt'), ex = {}, traps = {};
  KIND.forEach(([k]) => { ex[k] = { n: 0, ok: 0 }; });
  const days = {}, pass = { keep: [0, 0], change: [0, 0] };
  for (const id in at) {
    const a = at[id];
    if (id.indexOf(':trap') > -1) { if (a.t) traps[a.t] = (traps[a.t] || 0) + 1; continue; }
    const k = id.split(':')[0];
    if (!ex[k] || a.ok == null) continue;
    ex[k].n++; ex[k].ok += a.ok ? 1 : 0;
    if (a.at) {
      const d = new Date(a.at); const key = A.iso(d);
      (days[key] = days[key] || [0, 0])[1]++;
      if (a.ok) days[key][0]++;
    }
    if (a.pass === 1 || a.pass === 2) {
      const b = a.pass === 1 ? pass.keep : pass.change;
      b[1]++; if (a.ok) b[0]++;
    }
  }
  return { ex, traps, days, pass };
}
const pct = (a, b) => (b ? Math.round(100 * a / b) : null);

/* ---------- גרף מגמה ---------- */
function trend(days) {
  const keys = Object.keys(days).filter((d) => days[d][1] >= 3).sort();
  if (keys.length < 3) return null;
  /* הציר מתחיל ב-40% ולא באפס. דיוק מתחת לזה לא מבחין בין מצבים
     שמעניינים כאן, ואפס היה דוחס את כל הנתונים לחמישית העליונה. */
  const LOW = 0.4;
  const W = 320, H = 110, PL = 26, PR = 6, PT = 8, PB = 16;
  const x = (i) => PL + (W - PL - PR) * (keys.length === 1 ? 0 : i / (keys.length - 1));
  const y = (v) => PT + (H - PT - PB) * (1 - (Math.max(v, LOW) - LOW) / (1 - LOW));
  const pts = keys.map((d, i) => x(i).toFixed(1) + ',' + y(days[d][0] / days[d][1]).toFixed(1)).join(' ');
  const target = y(0.86);
  const box = el('div', 'trend');
  box.innerHTML =
    '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="מגמת הדיוק לאורך זמן">' +
    '<line class="gr" x1="' + PL + '" y1="' + y(LOW) + '" x2="' + W + '" y2="' + y(LOW) + '"/>' +
    '<line class="gr" x1="' + PL + '" y1="' + y(1) + '" x2="' + W + '" y2="' + y(1) + '"/>' +
    '<line class="tgt" x1="' + PL + '" y1="' + target.toFixed(1) + '" x2="' + W + '" y2="' + target.toFixed(1) + '"/>' +
    '<text class="axl" x="' + (PL - 4) + '" y="' + (y(1) + 4) + '" text-anchor="end">100</text>' +
    '<text class="axl" x="' + (PL - 4) + '" y="' + (target + 4).toFixed(1) + '" text-anchor="end">86</text>' +
    '<text class="axl" x="' + (PL - 4) + '" y="' + (y(LOW) + 4) + '" text-anchor="end">40</text>' +
    '<polyline class="ln" points="' + pts + '"/>' +
    keys.map((d, i) => '<circle class="pt" cx="' + x(i).toFixed(1) + '" cy="' +
      y(days[d][0] / days[d][1]).toFixed(1) + '" r="2.6"/>').join('') +
    '</svg>' +
    '<div class="tlab"><span>' + esc(heDate(keys[0])) + '</span>' +
    '<span>קו 86% הוא הדיוק שמביא ל-134</span>' +
    '<span>' + esc(heDate(keys[keys.length - 1])) + '</span></div>';
  return box;
}

/* ============================================================ */
async function view(v) {
  await scale();
  const { ex, traps, days, pass } = split();
  const total = KIND.reduce((s, [k]) => s + ex[k].n, 0);

  const head = el('div', 'sec');
  head.appendChild(el('span', 'eyebrow', 'האם אני בקצב ל-134?'));
  if (!total) {
    head.appendChild(el('div', 'note',
      'עוד לא ענית על שאלות מבחן. אחרי פרק אחד יופיע כאן אומדן ציון, ' +
      'ואחרי שלושה ימי תרגול תופיע מגמה.'));
    v.appendChild(head);
    return maturity(v);
  }

  /* ---- אומדן משוקלל לפי מבנה הבחינה ---- */
  let num = 0, den = 0;
  KIND.forEach(([k, , w]) => { if (ex[k].n) { num += ex[k].ok / ex[k].n * w; den += w; } });
  const acc = den ? num / den : 0;
  const raw = Math.round(acc * 44);
  const est = toScale(acc);
  const lo = SCALE ? SCALE[Math.max(0, raw - 3)] : null;
  const hi = SCALE ? SCALE[Math.min(44, raw + 3)] : null;

  if (est) {
    head.appendChild(el('div', 'figs',
      '<div class="fig"><span class="n rng">' + lo + '–' + hi + '</span><span class="k">טווח משוער</span></div>' +
      '<div class="fig ' + (est >= 134 ? 'new' : 'due') + '"><span class="n">' + est + '</span><span class="k">אמצע</span></div>' +
      '<div class="fig"><span class="n">' + total + '</span><span class="k">שאלות</span></div>'));
    head.appendChild(el('div', 'note', est >= 134
      ? '<b style="color:var(--good)">אתה מעל סף הפטור בתרגול.</b> הרחב את מספר השאלות — ' +
        'טווח צר יותר הוא אומדן אמין יותר.'
      : 'הדיוק המשוקלל שלך <b>' + Math.round(acc * 100) + '%</b>. הסף ל-134 הוא כ-<b>86%</b>. ' +
        'הפער הזול ביותר נמצא בהשלמת משפטים — 12 מתוך 23 השאלות.'));
    head.appendChild(el('p', 'note',
      'האומדן נשען על טבלת ההמרה הרשמית ועל משקלי הפרקים. אמירנט אדפטיבי, ' +
      'ולכן זה כיוון ולא הבטחה — ומדגם קטן נותן טווח רחב בכוונה.'));
  }
  v.appendChild(head);

  /* ---- מגמה ---- */
  const tr = trend(days);
  const s2 = el('div', 'sec');
  s2.appendChild(el('span', 'eyebrow', 'מגמה'));
  if (tr) s2.appendChild(tr);
  else s2.appendChild(el('div', 'note',
    'צריך שלושה ימים עם לפחות שלוש שאלות בכל אחד כדי לצייר מגמה. ' +
    'פחות מזה הוא רעש ולא קו.'));
  v.appendChild(s2);

  /* ---- דיוק לפי פרק ---- */
  const s3 = el('div', 'sec');
  s3.appendChild(el('span', 'eyebrow', 'דיוק לפי סוג פרק'));
  KIND.forEach(([k, he, w]) => {
    const p = pct(ex[k].ok, ex[k].n);
    const row = el('div', 'item');
    row.innerHTML = '<div class="b"><b>' + esc(he) + '</b> · ' + w + ' מתוך ' + TOTALQ +
      ' שאלות · ' + Math.round(100 * w / TOTALQ) + '% מהציון' +
      '<br><span class="tiny muted">' + (ex[k].n ? ex[k].n + ' שאלות נענו' : 'טרם נענו שאלות') + '</span></div>' +
      (p == null ? '<div class="pill">—</div>'
        : '<div class="pill ' + (p >= 86 ? 'good' : 'bad') + '">' + p + '%</div>');
    s3.appendChild(row);
  });
  v.appendChild(s3);

  /* ---- מעבר ראשון מול שינוי ---- */
  const s4 = el('div', 'sec');
  s4.appendChild(el('span', 'eyebrow', 'כשאתה משנה תשובה'));
  const nk = pass.keep[1], nc = pass.change[1];
  if (nk + nc < 10) {
    s4.appendChild(el('div', 'note',
      'נמדד רק בפרק אמיתי, שבו הניווט בין השאלות חופשי. אחרי כעשר שאלות ' +
      'כאלה תדע אם שינוי תשובה עוזר לך או מזיק — לכל אחד יש על זה דעה, ' +
      'וכמעט אף אחד לא מדד.'));
  } else {
    const pk = pct(pass.keep[0], nk), pc = pct(pass.change[0], nc);
    s4.appendChild(el('div', 'statgrid',
      '<div class="stat"><div class="v">' + (pk == null ? '—' : pk + '%') + '</div>' +
      '<div class="l">נשארת עם הראשונה</div><div class="s">' + nk + ' שאלות</div></div>' +
      '<div class="stat"><div class="v">' + (pc == null ? '—' : pc + '%') + '</div>' +
      '<div class="l">שינית תשובה</div><div class="s">' + nc + ' שאלות</div></div>'));
    s4.appendChild(el('div', 'note', pc == null || pk == null ? '' :
      pc > pk + 5 ? 'שינוי התשובה <b>עוזר לך</b>. אל תיצמד לתחושה הראשונה — יש לך זמן, השתמש בו.'
      : pk > pc + 5 ? 'התחושה הראשונה שלך <b>טובה יותר</b>. שנה רק כשמצאת נימוק חדש, לא כשהתלבטת.'
      : 'אין הבדל משמעותי בינתיים. עוד שאלות יחדדו את זה.'));
  }
  v.appendChild(s4);

  /* ---- מפת המלכודות ---- */
  const s5 = el('div', 'sec');
  s5.appendChild(el('span', 'eyebrow', 'מפת המלכודות'));
  const tk = Object.keys(traps).sort((a, b) => traps[b] - traps[a]);
  if (!tk.length) {
    s5.appendChild(el('div', 'note',
      'המפה נבנית מהתיוגים שלך בצייד המלכודות. היא לא נבנית אוטומטית בכוונה: ' +
      'בניתי חמישה מזהים לסוגי המלכודות ומדדתי אותם על 693 מסיחים — כולם נורים ' +
      'על התשובה הנכונה באותו שיעור כמו על המסיח. אי אפשר לזהות את זה מבחוץ, ' +
      'ולכן השיפוט שלך הוא המקור היחיד.'));
  } else {
    const max = traps[tk[0]];
    tk.forEach((k) => {
      const row = el('div', 'item');
      row.innerHTML = '<div class="b"><b>' + esc(TRAP_HE[k] || k) + '</b>' +
        '<div class="bar" style="margin-top:5px"><i style="width:' +
        (100 * traps[k] / max) + '%;background:var(--bad);opacity:.7"></i></div></div>' +
        '<div class="pill">' + traps[k] + '</div>';
      s5.appendChild(row);
    });
    s5.appendChild(el('p', 'note', 'התיוגים שלך, לא שלי. הסוג העליון הוא זה שאתה ' +
      'מזהה הכי הרבה — שווה לחזור על הפריטים האלה בבנק הטעויות.'));
  }
  v.appendChild(s5);

  maturity(v);
}

/* ---------- בשלות וקצב ---------- */
function maturity(v) {
  const cnt = { new: 0, young: 0, solid: 0, strong: 0 };
  S.words.forEach((o, w) => { cnt[bucket(card(w))]++; });
  const tot = S.words.size || 1;
  const s = el('div', 'sec');
  s.appendChild(el('span', 'eyebrow', 'המאגר וקצב הכיסוי'));
  s.appendChild(el('div', 'bar',
    '<i style="width:' + (cnt.strong / tot * 100) + '%;background:var(--good)"></i>' +
    '<i style="width:' + (cnt.solid / tot * 100) + '%;background:var(--accent);opacity:.7"></i>' +
    '<i style="width:' + (cnt.young / tot * 100) + '%;background:var(--warn);opacity:.6"></i>'));
  s.appendChild(el('div', 'legend',
    '<span><i class="dot" style="background:var(--good)"></i>מבוססות ' + cnt.strong + '</span>' +
    '<span><i class="dot" style="background:var(--accent);opacity:.7"></i>יציבות ' + cnt.solid + '</span>' +
    '<span><i class="dot" style="background:var(--warn);opacity:.6"></i>טריות ' + cnt.young + '</span>' +
    '<span><i class="dot" style="background:var(--surface-2)"></i>טרם נלמדו ' + cnt.new + '</span>'));
  if (cnt.new) {
    const days = Math.max(1, studyDaysLeft(today(), S.exam) - 10);
    const need = Math.ceil(cnt.new / days);
    const goal = pref('newPerDay', 35);
    s.appendChild(el('div', 'note',
      '<b>' + cnt.new + '</b> מילים שלא נגעת בהן ו-<b>' + Math.round(studyDaysLeft(today(), S.exam)) +
      '</b> ימי לימוד בפועל עד המבחן (שבתות וחגים מנוכים). לכיסוי לפני שלב הסגירה ' +
      'צריך <b>' + need + '</b> ביום, והיעד הנוכחי הוא ' + goal +
      (need <= goal ? ' — מספיק.' : ' — לא יספיק.')));
  }
  v.appendChild(s);
}

window.AMProgress = { view };

})();
