-- אמירנט — טבלאות האפליקציה החדשה
--
-- תוספתי בלבד. אין כאן שום ALTER ושום DROP, ואין נגיעה ב-user_kv או בכל
-- טבלה קיימת של ארכיון השחזורים. אם תריץ את הקובץ הזה פעמיים לא יקרה כלום
-- רע — הכל מוגן ב-if not exists.
--
-- להרצה: Supabase Dashboard → SQL Editor → הדבק והרץ.

-- ============================================================
-- 1. am_kv — המצב הפרטי של כל לומד
-- ============================================================
-- אותו דפוס כמו user_kv, בטבלה נפרדת משלה כדי לא לגעת ב-CHECK הקיים שם.
--   ns='cards'  k=word            v=מצב FSRS {st,dd,d,r,l,last,known}
--   ns='assoc'  k=word            v={text,at}
--   ns='stats'  k=YYYY-MM-DD      v={rev,ok,new,sec}
--   ns='attempt' k=itemId         v={chosen,ms,at,pass}
--   ns='prefs'  k=שם ההעדפה       v=ערך
--   ns='print'  k=batchId         v={words,layout,at,reconciled}

create table if not exists public.am_kv (
  user_id    uuid not null references auth.users(id) on delete cascade,
  ns         text not null check (ns in ('cards','assoc','stats','attempt','prefs','print')),
  k          text not null,
  v          jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, ns, k)
);

alter table public.am_kv enable row level security;

drop policy if exists "am_kv own rows" on public.am_kv;
create policy "am_kv own rows"
  on public.am_kv for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 2. am_duo — החדר המשותף
-- ============================================================
-- שני לומדים מצטרפים במפורש לאותו חדר, ורק אז הם רואים זה את זה. בלי
-- הצטרפות מפורשת אף אחד לא רואה כלום.

create table if not exists public.am_duo (
  user_id   uuid not null references auth.users(id) on delete cascade,
  room      text not null,
  name      text not null,
  joined_at timestamptz not null default now(),
  primary key (user_id)
);

alter table public.am_duo enable row level security;

-- החברות של עצמך: קריאה וכתיבה מלאה.
drop policy if exists "am_duo own row" on public.am_duo;
create policy "am_duo own row"
  on public.am_duo for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- מי בחדר שלי. security definer כדי שהפונקציה תוכל לקרוא את הטבלה בלי
-- להיתקל ב-RLS של עצמה, אחרת המדיניות הבאה הייתה רקורסיבית.
create or replace function public.am_my_room()
returns text language sql stable security definer set search_path = public as $$
  select room from public.am_duo where user_id = auth.uid()
$$;

-- קריאה של שורות חברי אותו חדר.
drop policy if exists "am_duo roommates" on public.am_duo;
create policy "am_duo roommates"
  on public.am_duo for select to authenticated
  using (room = public.am_my_room());

-- ============================================================
-- 3. am_share — מה שהיריב רואה
-- ============================================================
-- רק מה שהתחרות צריכה: הסטטיסטיקה היומית, הרצף, והאסוציאציות
-- שהלומד בחר לשתף. שאר המצב נשאר פרטי ב-am_kv.
--   kind='day'    k=YYYY-MM-DD   v={rev,ok,new,streak,score}
--   kind='assoc'  k=word         v={text,stars}
--   kind='puzzle' k=YYYY-MM-DD   v={game,result,ms}

create table if not exists public.am_share (
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('day','assoc','puzzle')),
  k          text not null,
  v          jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, k)
);

alter table public.am_share enable row level security;

drop policy if exists "am_share own rows" on public.am_share;
create policy "am_share own rows"
  on public.am_share for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "am_share roommates read" on public.am_share;
create policy "am_share roommates read"
  on public.am_share for select to authenticated
  using (exists (
    select 1 from public.am_duo d
    where d.user_id = am_share.user_id
      and d.room = public.am_my_room()
  ));

-- ============================================================
-- 4. updated_at אוטומטי
-- ============================================================
create extension if not exists moddatetime schema extensions;

drop trigger if exists am_kv_touch on public.am_kv;
create trigger am_kv_touch before update on public.am_kv
  for each row execute function extensions.moddatetime(updated_at);

drop trigger if exists am_share_touch on public.am_share;
create trigger am_share_touch before update on public.am_share
  for each row execute function extensions.moddatetime(updated_at);
