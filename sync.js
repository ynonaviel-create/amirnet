#!/usr/bin/env node
/* sync.js — מאחד את קובצי המשמעות לתוך data/words.json ובודק תקינות.
   מריצים לפני כל דחיפה:  node sync.js  */
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const words = JSON.parse(fs.readFileSync('data/words.json', 'utf8'));
const byWord = new Map(words.map((w) => [w.w, w]));

let added = 0, unknown = [], bad = [];
const dir = 'data/gloss';
for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.txt')).sort() : []) {
  fs.readFileSync(path.join(dir, f), 'utf8').split('\n').forEach((line, i) => {
    if (!line.trim()) return;
    const p = line.split('|');
    if (p.length !== 5) { bad.push(`${f}:${i + 1} — ${p.length} שדות במקום 5`); return; }
    const [w, pos, he, def, syn] = p.map((x) => x.trim());
    const rec = byWord.get(w);
    if (!rec) { unknown.push(w); return; }
    rec.pos = pos; rec.he = he; rec.def = def;
    rec.syn = syn ? syn.split(';').map((s) => s.trim()).filter(Boolean) : [];
    added++;
  });
}

/* בדיקות תקינות על בנק השאלות. הוא לא בריפו — הקבצים המקומיים ב-data-private
   הם המקור שממנו זורעים את המסד, ולכן נבדקים כאן לפני שהם עולים.

   הבדיקות האלה נולדו מבאג אמיתי: כלל ניקוי שנכתב לאפשרות של מילה בודדת
   הופעל גם על משפטים שלמים וחתך כל אפשרות בפסיק הראשון. אף בדיקה קיימת
   לא תפסה את זה, והתוצאה הייתה פריטים בלתי אפשריים לפתרון. */
const errs = [], warns = [];
const BANK = 'data-private';
const TRUNC_TELL = /\b(a|an|the|of|in|on|to|and|or|but|with|for|from|by|as|at|that|which|than|is|was|were|are|his|her|its|their)$/i;
const wordCount = (s) => s.trim().split(/\s+/).length;

for (const [file, lo, hi] of (fs.existsSync(BANK) ? [['sc', 1, 8], ['rs', 9, 12], ['rc', 13, 22]] : [])) {
  const items = JSON.parse(fs.readFileSync(`${BANK}/${file}.json`, 'utf8'));
  const sentenceOpts = file !== 'sc';
  items.forEach((it) => {
    const at = `${file} ${it.exam}/${it.sec}/${it.n}`;
    if (!Number.isInteger(it.answer) || it.answer < 0 || it.answer > 3)
      errs.push(`${at}: תשובה מחוץ לטווח`);
    if (!it.options || it.options.length !== 4 || it.options.some((o) => !o))
      errs.push(`${at}: אין ארבע אפשרויות`);
    else if (new Set(it.options.map((o) => o.toLowerCase())).size < 4)
      errs.push(`${at}: אפשרויות כפולות — סימן מובהק לקטימה`);
    if (it.n < lo || it.n > hi) errs.push(`${at}: מספר שאלה מחוץ לטווח`);

    if (sentenceOpts && it.options && it.options.length === 4) {
      /* סימן הקטימה החזק ביותר: אפשרות שנגמרת במילת פונקציה. משפט אמיתי
         לעולם לא נגמר ב-"of" או ב-"the"; אפשרות שכן — נחתכה. יחס אורך
         לבדו אינו מספיק, כי אפשרויות אמיתיות משתנות באורכן. */
      /* רק בניסוח מחדש: שם כל אפשרות היא משפט עצמאי. בהבנת הנקרא
         האפשרות ממלאת חסר בתוך הגזע, ולכן היא *כן* יכולה להיגמר במילת
         יחס — "The main purpose of the last paragraph is to ____ balloons"
         עם האפשרות "present an alternative view of". */
      if (file === 'rs') {
        it.options.forEach((o, i) => {
          if (TRUNC_TELL.test(o)) errs.push(`${at}: אפשרות ${i + 1} נגמרת ב-"${o.split(/\s+/).pop()}" — נקטמה`);
        });
      }
      const L = it.options.map(wordCount);
      const max = Math.max(...L);
      L.forEach((n, i) => {
        if (max >= 12 && n < max / 3) warns.push(`${at}: אפשרות ${i + 1} קצרה חריג (${n} מול ${max})`);
      });
    }
    if (file === 'sc') {
      if (!/_{2,}/.test(it.stem)) errs.push(`${at}: אין סימון למקום החסר`);
      if (it.full && /_/.test(it.full)) errs.push(`${at}: נשאר קו תחתון במשפט השלם`);
    }
  });
}

if (fs.existsSync(`${BANK}/passages.json`)) {
  JSON.parse(fs.readFileSync(`${BANK}/passages.json`, 'utf8')).forEach((p) => {
    if (/Questions\s*$/.test(p.text)) errs.push(`passage ${p.id}: שארית "Questions" בסוף`);
    if (/©/.test(p.text)) errs.push(`passage ${p.id}: שארית זכויות יוצרים`);
  });
}

fs.writeFileSync('data/words.json', JSON.stringify(words));

/* חתימת גרסה. בלי זה ה-Service Worker ממשיך להגיש את הקליפה הישנה מהמטמון
   ועדכון פשוט לא מגיע למשתמש — תקלה שקטה שקשה לאבחן אחר כך. */
const stamp = crypto.createHash('sha1').update(
  ['assets/app.js', 'assets/today.js', 'assets/print.js', 'assets/progress.js', 'assets/exam.js', 'assets/words.js', 'assets/onboard.js', 'assets/strategy.js', 'assets/drills.js', 'assets/cloud.js', 'assets/style.css',
   'assets/tokens.css', 'assets/components.css', 'index.html', 'sw.js',
   'data/words.json', 'data/quads.json', 'data/pairs.json', 'data/scale.json']
    .filter((f) => fs.existsSync(f))
    .map((f) => fs.readFileSync(f)).join('')
).digest('hex').slice(0, 8);
/* sw.js משתתף בחתימה ולכן החתימה מחושבת על הגרסה שלפני הכתיבה — אחרת
   כל הרצה הייתה משנה את הקלט של עצמה. */
fs.writeFileSync('sw.js', fs.readFileSync('sw.js', 'utf8').replace(/const V = '[^']*'/, `const V = 'amirnet-${stamp}'`));
console.log('גרסת מטמון:', stamp);
const withDef = words.filter((w) => w.def).length;
console.log(`מילים במאגר: ${words.length} · עם משמעות: ${withDef} (${Math.round(withDef / words.length * 100)}%)`);
if (unknown.length) console.log(`מילים שלא במאגר (${unknown.length}): ${unknown.slice(0, 12).join(', ')}`);
if (bad.length)     console.log('שורות פגומות:\n  ' + bad.join('\n  '));
if (warns.length)   console.log(`אזהרות (${warns.length}):\n  ` + warns.slice(0, 5).join('\n  '));
if (errs.length)    { console.log(`שגיאות בבנק השאלות (${errs.length}):\n  ` + errs.slice(0, 12).join('\n  ')); process.exit(1); }
console.log(fs.existsSync(BANK) ? 'בנק השאלות תקין.' : 'בנק השאלות לא נמצא מקומית — דילגתי על הבדיקה.');
