begin;

create table if not exists public.roulette_cancellations (
  user_id uuid not null references auth.users(id) on delete cascade,
  station_id text not null,
  station_name text not null,
  lines text[] not null,
  selected_at timestamptz not null,
  day date generated always as ((selected_at at time zone 'Asia/Seoul')::date) stored,
  cancelled_at timestamptz not null default clock_timestamp(),
  primary key (user_id, station_id, selected_at)
);
alter table public.roulette_cancellations enable row level security;
revoke all on public.roulette_cancellations from anon, authenticated;
grant select on public.roulette_cancellations to authenticated;
drop policy if exists roulette_cancellations_owner_read on public.roulette_cancellations;
create policy roulette_cancellations_owner_read on public.roulette_cancellations for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.roulette_cancel(p_station_id text, p_selected_at timestamptz)
returns public.roulette_cancellations
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_choice public.roulette_choices;
  v_cancelled public.roulette_cancellations;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_station_id is null or p_selected_at is null then raise exception 'INVALID_CHOICE'; end if;
  -- Match the selection timestamp so an old tab cannot cancel a newer selection.
  select * into v_choice from public.roulette_choices
    where user_id=v_user and station_id=p_station_id and selected_at=p_selected_at for update;
  if not found then
    select * into v_cancelled from public.roulette_cancellations
      where user_id=v_user and station_id=p_station_id and selected_at=p_selected_at;
    if found then return v_cancelled; end if;
    raise exception 'CHOICE_CHANGED';
  end if;
  -- Archive and removal are atomic; the original date and station are retained.
  insert into public.roulette_cancellations(user_id,station_id,station_name,lines,selected_at)
    values(v_user,v_choice.station_id,v_choice.station_name,v_choice.lines,v_choice.selected_at)
    on conflict(user_id,station_id,selected_at) do nothing;
  delete from public.roulette_choices
    where user_id=v_user and station_id=p_station_id and selected_at=p_selected_at;
  select * into strict v_cancelled from public.roulette_cancellations
    where user_id=v_user and station_id=p_station_id and selected_at=p_selected_at;
  return v_cancelled;
end;
$$;
revoke all on function public.roulette_cancel(text,timestamptz) from public, anon;
grant execute on function public.roulette_cancel(text,timestamptz) to authenticated;

commit;
