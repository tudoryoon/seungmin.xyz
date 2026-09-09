begin;

create table if not exists public.journal_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  kind text not null check (kind in ('event', 'workout')),
  date date not null,
  title text not null check (char_length(title) between 1 and 100),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 24000),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.journal_records enable row level security;
revoke all on public.journal_records from anon, authenticated;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.journal_records to authenticated;

drop policy if exists journal_select_own on public.journal_records;
create policy journal_select_own on public.journal_records for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists journal_insert_own on public.journal_records;
create policy journal_insert_own on public.journal_records for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists journal_update_own on public.journal_records;
create policy journal_update_own on public.journal_records for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists journal_delete_own on public.journal_records;
create policy journal_delete_own on public.journal_records for delete to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists journal_records_user_date on public.journal_records(user_id, date);
commit;
