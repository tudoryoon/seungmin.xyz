begin;

create table if not exists public.roulette_choices (
  user_id uuid not null references auth.users(id) on delete cascade,
  station_id text not null check (char_length(station_id) between 1 and 120),
  station_name text not null check (char_length(btrim(station_name)) between 1 and 100),
  lines text[] not null check (cardinality(lines) between 1 and 10 and lines <@ array['1호선','2호선','3호선','4호선','5호선','6호선','7호선','8호선','9호선','경의중앙선']::text[]),
  selected_at timestamptz not null default clock_timestamp(),
  day date generated always as ((selected_at at time zone 'Asia/Seoul')::date) stored,
  primary key (user_id, station_id)
);
alter table public.roulette_choices enable row level security;
revoke all on public.roulette_choices from anon, authenticated;
grant select on public.roulette_choices to authenticated;
drop policy if exists roulette_choices_owner_read on public.roulette_choices;
create policy roulette_choices_owner_read on public.roulette_choices for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.roulette_choose(p_station_id text, p_station_name text, p_lines text[])
returns public.roulette_choices
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_choice public.roulette_choices;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  -- The first selection fixes the server-side date. Retries never rewrite history.
  insert into public.roulette_choices(user_id, station_id, station_name, lines)
    values(v_user, p_station_id, btrim(p_station_name), p_lines)
    on conflict(user_id, station_id) do nothing;
  select * into strict v_choice from public.roulette_choices
    where user_id=v_user and station_id=p_station_id;
  return v_choice;
end;
$$;
revoke all on function public.roulette_choose(text,text,text[]) from public, anon;
grant execute on function public.roulette_choose(text,text,text[]) to authenticated;

commit;
