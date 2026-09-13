/* ================= אמירנט — כניסה ראשונה וליטוש =================

   שלושה דברים שהאפליקציה הייתה חסרה כדי להיות שמישה ביום־יום ולא רק
   נכונה:

   · כניסה ראשונה. מסך שנפתח על 1,638 מילים בלי הסבר לא אומר מה לעשות.
     שלושה צעדים, חצי דקה, ואז ישר למיון.
   · מקלדת. 1–4 לבחירה, Enter להמשך, Esc לסגירה. מי שמתרגל מהמחשב
     עושה מאות בחירות בשעה, ועכבר לכל אחת הוא חיכוך מיותר.
   · באנר אופליין. האפליקציה עובדת אופליין חוץ מבנק השאלות, וההבדל
     חייב להיות גלוי — אחרת "הפרק לא נטען" נראה כמו תקלה.
   ============================================================== */
'use strict';

(function () {

const A = window.AM;
const { el, esc, pref, setPref, S, today, heDate, between, isOff } = A;

/* ============================================================
   כניסה ראשונה
   ============================================================ */
const STEPS = [
  {
    eyebrow: 'מה זה המקום הזה',
    title: 'המבחן לא בודק כמה מילים אתה יודע',
    body: 'הוא בודק כמה תשובות אתה יכול לפסול. ידיעה של <b>שתיים מארבע</b> ' +
      'האפשרויות, בלי לדעת מי הנכונה, שווה <b>75%</b> הצלחה. ' +
      'כל מה שכאן בנוי סביב המספר הזה.',
    fig: ['25%', '33%', '50%', '100%'],
    figlab: ['ניחוש', 'פסילה אחת', 'שתי פסילות', 'שלוש'],
  },
  {
    eyebrow: 'מתי המבחן',
    title: 'התזמון נגזר מהתאריך',
    body: 'החזרות מתוזמנות כך שאף מילה לא תיפול אחרי המבחן, ושבתות וחגים ' +
      'מנוכים מספירת ימי הלימוד. עשרה ימים לפני המבחן המערכת עוברת ' +
      'למצב סגירה ומעלה את יעד הזכירה.',
    field: 'date',
  },
  {
    eyebrow: 'כמה ביום',
    title: 'מילים חדשות ליום',
    body: 'זה היעד לחדשות בלבד — חזרות מגיעות בנוסף, לפי מה שהתזמון מבקש. ' +
      'אפשר לשנות בכל רגע תחת <b>עוד ← כיול</b>, ושם גם ' +
      '<b>"מה זה, ואיך משתמשים"</b> — הסבר מלא על המבחן ועל כל מסך. ' +
      'המסך הבא הוא מיון מהיר: תסמן מה שאתה כבר יודע, וזה ייצא מהתור.',
    field: 'num',
  },
];

let ST = null;

function paintStep() {
  const st = STEPS[ST.i];
  const c = el('div', 'card'), mid = el('div', 'mid');
  let h = '<span class="eyebrow">' + esc(st.eyebrow) + '</span>' +
    '<h2 class="obt">' + st.title + '</h2>' +
    '<p class="note" style="text-align:center;max-width:42ch">' + st.body + '</p>';
  mid.innerHTML = h;

  if (st.fig) {
    const g = el('div', 'ladder');
    st.fig.forEach((p, i) => {
      g.innerHTML += '<div class="rung"><b>' + esc(p) + '</b><span>' + esc(st.figlab[i]) + '</span></div>';
    });
    mid.appendChild(g);
  }
  if (st.field === 'date') {
    const inp = el('input', 't mono');
    inp.type = 'date'; inp.id = 'ob-date'; inp.value = ST.exam;
    inp.setAttribute('aria-label', 'תאריך המבחן');
    inp.style.cssText = 'max-width:20ch;text-align:center';
    inp.onchange = () => { ST.exam = inp.value || ST.exam; paintStep(); };
    mid.appendChild(inp);
    const left = between(today(), ST.exam);
    mid.appendChild(el('div', 'note',
      left > 0 ? '<b>' + left + '</b> ימים, מתוכם <b>' +
        Math.round(A.studyDaysLeft(today(), ST.exam)) + '</b> ימי לימוד בפועל.'
      : 'התאריך הזה כבר עבר.'));
  }
  if (st.field === 'num') {
    const inp = el('input', 't mono');
    inp.type = 'number'; inp.min = '5'; inp.max = '120'; inp.id = 'ob-num';
    inp.value = ST.perDay;
    inp.setAttribute('aria-label', 'מילים חדשות ביום');
    inp.style.cssText = 'max-width:12ch;text-align:center';
    inp.oninput = () => { ST.perDay = Math.max(5, Math.min(120, +inp.value || 35)); paintStep(); };
    mid.appendChild(inp);
    const days = Math.max(1, A.studyDaysLeft(today(), ST.exam) - 10);
    const need = Math.ceil(S.words.size / days);
    mid.appendChild(el('div', 'note',
      'לכיסוי כל <b>' + S.words.size + '</b> המילים לפני שלב הסגירה צריך <b>' + need +
      '</b> ביום. ' + (ST.perDay >= need
        ? 'היעד שלך מספיק.'
        : 'היעד שלך נמוך מזה — המיון המהיר יקצר את הרשימה, וזה בסדר.')));
  }

  const acts = el('div', 'acts');
  const go = el('button', 'btn', ST.i === STEPS.length - 1 ? 'למיון המהיר' : 'הבא');
  go.onclick = next;
  acts.appendChild(go);
  if (ST.i) {
    const back = el('button', 'btn ghost sm', 'אחורה');
    back.onclick = () => { ST.i--; paintStep(); };
    acts.appendChild(back);
  }
  const skip = el('button', 'btn ghost sm', 'דלג');
  skip.onclick = done;
  acts.appendChild(skip);

  c.append(mid, acts);
  const box = A.openStudy(c, { i: ST.i, n: STEPS.length, right: (ST.i + 1) + '/' + STEPS.length, close: done });
  box.className = 'study m-elim';
}

function next() {
  if (ST.i < STEPS.length - 1) { ST.i++; return paintStep(); }
  done(true);
}
function done(goTriage) {
  setPref('exam', ST.exam);
  setPref('newPerDay', ST.perDay);
  setPref('onboarded', Date.now());
  S.exam = ST.exam;
  ST = null;
  A.closeStudy();
  A.render();
  if (goTriage === true) setTimeout(() => A.startTriage(120), 120);
}

function start() {
  ST = { i: 0, exam: S.exam, perDay: pref('newPerDay', 35) };
  paintStep();
}

/* ============================================================
   מקלדת
   ============================================================
   1–4 בוחרות אפשרות, Enter לוחצת על הכפתור הראשי, Esc סוגרת.
   נתפס ברמת המסמך ולא בכל מסך בנפרד, כי כל המסכים משתמשים באותם
   מחלקות — וכך זה לא יכול להתפספס במסך חדש. */
function primary(box) {
  const acts = box.querySelector('.acts');
  if (!acts) return null;
  return acts.querySelector('.btn:not(.ghost):not(:disabled)') ||
         acts.querySelector('.btn:not(:disabled)');
}
document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
  const box = document.querySelector('#study');
  if (!box) return;

  if (e.key === 'Escape') {
    const x = box.querySelector('.sbar .x');
    if (x) { e.preventDefault(); x.click(); }
    return;
  }
  if (e.key >= '1' && e.key <= '9') {
    /* .opt קודם, ואז .grade. בפרק אמת .grade הוא הניווט בין השאלות
       ו-.opt הן התשובות, ולכן הסדר הזה נותן בכל מסך את מה שמצופה:
       בפרק — בחירת תשובה, במיון ובשיפוט — הכפתור המתאים. */
    const list = box.querySelectorAll('.opt:not(:disabled)').length
      ? box.querySelectorAll('.opt:not(:disabled)')
      : box.querySelectorAll('.grades .grade:not(:disabled)');
    const i = +e.key - 1;
    if (list[i]) { e.preventDefault(); list[i].click(); }
    return;
  }
  if (e.key === 'Enter' || e.key === ' ') {
    if (t && t.tagName === 'BUTTON') return;     // הכפתור עצמו כבר מטפל
    const b = primary(box);
    if (b) { e.preventDefault(); b.click(); }
  }
});

/* ---------- פוקוס בפתיחת שכבה ----------
   קורא מסך שלא הועבר לשכבה ממשיך להקריא את המסך שמאחוריה. */
const layer = document.querySelector('#layer');
if (layer && window.MutationObserver) {
  new MutationObserver((recs) => {
    recs.forEach((r) => {
      r.addedNodes.forEach((n) => {
        if (!n.id || n.id !== 'study') return;
        n.setAttribute('role', 'dialog');
        n.setAttribute('aria-modal', 'true');
        n.setAttribute('tabindex', '-1');
        try { n.focus({ preventScroll: true }); } catch (e) {}
      });
    });
  }).observe(layer, { childList: true });
}

/* ============================================================
   אופליין
   ============================================================
   המילון, הכרטיסים, התזמון וההדפסה עובדים בלי רשת. בנק השאלות לא —
   הוא יושב במסד מאחורי התחברות. בלי הבחנה מפורשת "הפרק לא נטען"
   נראה כמו באג. */
function paintNet() {
  let b = document.querySelector('#netbar');
  if (!navigator.onLine) {
    if (!b) {
      b = el('div', 'netbar', 'אין רשת — אוצר מילים, תזמון והדפסה עובדים. פרקי אמת ידרשו חיבור.');
      b.id = 'netbar';
      b.setAttribute('role', 'status');
      document.body.appendChild(b);
    }
  } else if (b) b.remove();
}
window.addEventListener('online', paintNet);
window.addEventListener('offline', paintNet);
paintNet();

window.AMOnboard = { start, needed: () => !pref('onboarded', 0), replay: start };

})();
