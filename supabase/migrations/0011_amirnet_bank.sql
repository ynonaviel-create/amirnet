-- אמירנט — בנק השאלות מאחורי התחברות
--
-- חוברות הבחינה של מאל"ו נושאות איסור העתקה והפצה מפורש. הכרייה לשימוש
-- לימודי אישית היא דבר אחד; אתר ציבורי שממנו אפשר להוריד את השאלות הוא
-- הפצה. לכן בנק השאלות לא יושב בקוד אלא כאן, וקריאה ממנו דורשת התחברות.
--
-- תוספתי בלבד: טבלה חדשה אחת, בלי נגיעה בשום דבר קיים.
-- להרצה: Supabase Dashboard → SQL Editor → הדבק והרץ.

create table if not exists public.am_bank (
  kind       text not null check (kind in ('sc','rs','rc','passage','sentence')),
  id         text not null,
  v          jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (kind, id)
);

alter table public.am_bank enable row level security;

-- כל מי שמחובר קורא; אין מדיניות ל-anon, ולכן מבקר לא מזוהה מקבל טבלה ריקה.
drop policy if exists "am_bank read" on public.am_bank;
create policy "am_bank read"
  on public.am_bank for select to authenticated
  using (true);

-- כתיבה שמורה למי שהעלה את הבנק מלכתחילה. בלי זה כל משתמש מחובר היה יכול
-- לדרוס את השאלות של כולם.
drop policy if exists "am_bank seed" on public.am_bank;
create policy "am_bank seed"
  on public.am_bank for all to authenticated
  using (auth.jwt() ->> 'email' = 'ynonaviel@gmail.com')
  with check (auth.jwt() ->> 'email' = 'ynonaviel@gmail.com');

create index if not exists am_bank_kind_idx on public.am_bank (kind);

drop trigger if exists am_bank_touch on public.am_bank;
create trigger am_bank_touch before update on public.am_bank
  for each row execute function extensions.moddatetime(updated_at);
