begin;

create table if not exists public.daily_plans (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
create table if not exists public.daily_tasks (
  user_id uuid not null,
  day date not null,
  id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  position integer not null check (position between 0 and 19),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day, id),
  foreign key (user_id, day) references public.daily_plans(user_id, day) on delete cascade
);
create table if not exists public.daily_rewards (
  user_id uuid not null,
  day date not null,
  awarded_at timestamptz not null default now(),
  primary key (user_id, day),
  foreign key (user_id, day) references public.daily_plans(user_id, day) on delete cascade
);

alter table public.daily_plans enable row level security;
alter table public.daily_tasks enable row level security;
alter table public.daily_rewards enable row level security;
revoke all on public.daily_plans, public.daily_tasks, public.daily_rewards from anon, authenticated;
grant select on public.daily_plans, public.daily_tasks, public.daily_rewards to authenticated;
drop policy if exists daily_plans_owner_read on public.daily_plans;
create policy daily_plans_owner_read on public.daily_plans for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists daily_tasks_owner_read on public.daily_tasks;
create policy daily_tasks_owner_read on public.daily_tasks for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists daily_rewards_owner_read on public.daily_rewards;
create policy daily_rewards_owner_read on public.daily_rewards for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.daily_plan_state() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_day date := (now() at time zone 'Asia/Seoul')::date;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  return jsonb_build_object(
    'day', v_day,
    'server_now', now(),
    'ends_at', (v_day + 1)::timestamp at time zone 'Asia/Seoul',
    'revision', coalesce((select revision from public.daily_plans where user_id=v_user and day=v_day), 0),
    'level', 1 + (select count(*) from public.daily_rewards where user_id=v_user),
    'awarded', exists(select 1 from public.daily_rewards where user_id=v_user and day=v_day),
    'tasks', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'completed', completed_at is not null) order by position, id)
      from public.daily_tasks where user_id=v_user and day=v_day), '[]'::jsonb)
  );
end;
$$;

create or replace function public.daily_plan_update(
  p_day date, p_revision bigint, p_action text,
  p_tasks jsonb default null, p_task_id uuid default null, p_completed boolean default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_revision bigint;
  v_task jsonb;
  v_ids uuid[] := '{}';
  v_id uuid;
  v_position integer := 0;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_day is distinct from v_day then raise exception 'DAY_CHANGED'; end if;
  if p_action is null or p_action not in ('save', 'check', 'finish') then raise exception 'INVALID_ACTION'; end if;
  if p_action = 'save' then
    insert into public.daily_plans(user_id, day) values (v_user, v_day) on conflict do nothing;
  end if;

  -- One lock serializes list edits and reward claims from all of this user's devices.
  select revision into v_revision from public.daily_plans where user_id=v_user and day=v_day for update;
  if not found then raise exception 'PLAN_REQUIRED'; end if;
  if exists(select 1 from public.daily_rewards where user_id=v_user and day=v_day) then
    if p_action = 'save' then raise exception 'ALREADY_COMPLETED'; end if;
    return public.daily_plan_state();
  end if;
  if p_revision is distinct from v_revision then raise exception 'PLAN_CHANGED'; end if;

  if p_action = 'save' then
    if p_tasks is null or jsonb_typeof(p_tasks) <> 'array' then raise exception 'INVALID_TASKS'; end if;
    if jsonb_array_length(p_tasks) not between 1 and 20 or octet_length(p_tasks::text) > 30000 then raise exception 'INVALID_TASKS'; end if;
    for v_task in select value from jsonb_array_elements(p_tasks) loop
      if jsonb_typeof(v_task) <> 'object' or jsonb_typeof(v_task->'title') is distinct from 'string'
        or char_length(btrim(v_task->>'title')) not between 1 and 160 then raise exception 'INVALID_TASKS'; end if;
      begin v_id := (v_task->>'id')::uuid;
      exception when invalid_text_representation then raise exception 'INVALID_TASKS'; end;
      if v_id is null or v_id = any(v_ids) then raise exception 'INVALID_TASKS'; end if;
      v_ids := array_append(v_ids, v_id);
      insert into public.daily_tasks(user_id, day, id, title, position)
        values(v_user, v_day, v_id, btrim(v_task->>'title'), v_position)
        on conflict (user_id, day, id) do update set title=excluded.title, position=excluded.position,
          completed_at=case when public.daily_tasks.title=excluded.title then public.daily_tasks.completed_at else null end,
          updated_at=now();
      v_position := v_position + 1;
    end loop;
    delete from public.daily_tasks where user_id=v_user and day=v_day and not(id=any(v_ids));
  elsif p_action = 'check' then
    if p_completed is null then raise exception 'INVALID_TASKS'; end if;
    update public.daily_tasks set completed_at=case when p_completed then coalesce(completed_at,now()) else null end, updated_at=now()
      where user_id=v_user and day=v_day and id=p_task_id;
    if not found then raise exception 'TASK_NOT_FOUND'; end if;
  end if;

  if p_action in ('check', 'finish') then
    if exists(select 1 from public.daily_tasks where user_id=v_user and day=v_day)
      and not exists(select 1 from public.daily_tasks where user_id=v_user and day=v_day and completed_at is null) then
      insert into public.daily_rewards(user_id, day) values(v_user, v_day) on conflict do nothing;
    elsif p_action = 'finish' then raise exception 'TASKS_REMAIN';
    end if;
  end if;
  update public.daily_plans set revision=revision+1, updated_at=now() where user_id=v_user and day=v_day;
  return public.daily_plan_state();
end;
$$;
revoke all on function public.daily_plan_state() from public, anon;
revoke all on function public.daily_plan_update(date,bigint,text,jsonb,uuid,boolean) from public, anon;
grant execute on function public.daily_plan_state() to authenticated;
grant execute on function public.daily_plan_update(date,bigint,text,jsonb,uuid,boolean) to authenticated;

commit;
