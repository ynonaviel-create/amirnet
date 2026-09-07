#!/usr/bin/env node
/* sync.js — מאחד את קובצי המשמעות לתוך data/words.json ובודק תקינות.
   מריצים לפני כל דחיפה:  node sync.js  */
const fs = require('fs'), path = require('path');

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
   הם המקור שממנו זורעים את המסד, ולכן נבדקים כאן לפני שהם עולים. */
const errs = [];
const BANK = 'data-private';
for (const [file, lo, hi] of (fs.existsSync(BANK) ? [['sc', 1, 8], ['rs', 9, 12], ['rc', 13, 22]] : [])) {
  const items = JSON.parse(fs.readFileSync(`${BANK}/${file}.json`, 'utf8'));
  items.forEach((it) => {
    if (!Number.isInteger(it.answer) || it.answer < 0 || it.answer > 3)
      errs.push(`${file} ${it.exam}/${it.n}: תשובה מחוץ לטווח`);
    if (!it.options || it.options.length !== 4 || it.options.some((o) => !o))
      errs.push(`${file} ${it.exam}/${it.n}: אין ארבע אפשרויות`);
    if (it.n < lo || it.n > hi) errs.push(`${file} ${it.exam}/${it.n}: מספר שאלה מחוץ לטווח`);
  });
}

fs.writeFileSync('data/words.json', JSON.stringify(words));
const withDef = words.filter((w) => w.def).length;
console.log(`מילים במאגר: ${words.length} · עם משמעות: ${withDef} (${Math.round(withDef / words.length * 100)}%)`);
if (unknown.length) console.log(`מילים שלא במאגר (${unknown.length}): ${unknown.slice(0, 12).join(', ')}`);
if (bad.length)     console.log('שורות פגומות:\n  ' + bad.join('\n  '));
if (errs.length)    { console.log('שגיאות בבנק השאלות:\n  ' + errs.slice(0, 10).join('\n  ')); process.exit(1); }
console.log(fs.existsSync(BANK) ? 'בנק השאלות תקין.' : 'בנק השאלות לא נמצא מקומית — דילגתי על הבדיקה.');
