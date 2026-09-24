begin;

-- Existing instant rewards remain recorded, but only closed-day settlements count.
alter table public.daily_rewards add column if not exists settled_at timestamptz;

create or replace function public.daily_plan_state() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_day date := (v_now at time zone 'Asia/Seoul')::date;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  -- Wait for any pre-midnight edit before deciding whether a closed day is complete.
  perform 1 from public.daily_plans where user_id=v_user and day<v_day order by day for update;
  insert into public.daily_rewards(user_id,day,settled_at)
    select p.user_id,p.day,v_now from public.daily_plans p
    where p.user_id=v_user and p.day<v_day
      and exists(select 1 from public.daily_tasks t where t.user_id=p.user_id and t.day=p.day)
      and not exists(select 1 from public.daily_tasks t where t.user_id=p.user_id and t.day=p.day
        and (t.completed_at is null or t.completed_at >= (p.day+1)::timestamp at time zone 'Asia/Seoul'))
    on conflict(user_id,day) do update set settled_at=excluded.settled_at where public.daily_rewards.settled_at is null;
  return jsonb_build_object(
    'day',v_day,'server_now',v_now,'ends_at',(v_day+1)::timestamp at time zone 'Asia/Seoul',
    'revision',coalesce((select revision from public.daily_plans where user_id=v_user and day=v_day),0),
    'level',1+(select count(*) from public.daily_rewards where user_id=v_user and day<v_day and settled_at is not null),
    'awarded',false,'reward_policy','kst_midnight',
    'tasks',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'completed',completed_at is not null) order by position,id)
      from public.daily_tasks where user_id=v_user and day=v_day),'[]'::jsonb)
  );
end;
$$;

create or replace function public.daily_plan_update(
  p_day date,p_revision bigint,p_action text,
  p_tasks jsonb default null,p_task_id uuid default null,p_completed boolean default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_day date := (clock_timestamp() at time zone 'Asia/Seoul')::date;
  v_revision bigint;
  v_task jsonb;
  v_ids uuid[] := '{}';
  v_id uuid;
  v_position integer := 0;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_day is distinct from v_day then raise exception 'DAY_CHANGED'; end if;
  if p_action is null or p_action not in ('save','check','finish') then raise exception 'INVALID_ACTION'; end if;
  -- Always lock historical plans before today's plan, including near midnight.
  perform public.daily_plan_state();
  if p_action='save' then
    insert into public.daily_plans(user_id,day) values(v_user,v_day) on conflict do nothing;
  end if;
  select revision into v_revision from public.daily_plans where user_id=v_user and day=v_day for update;
  if not found then raise exception 'PLAN_REQUIRED'; end if;
  if p_day is distinct from (clock_timestamp() at time zone 'Asia/Seoul')::date then raise exception 'DAY_CHANGED'; end if;
  if p_revision is distinct from v_revision then raise exception 'PLAN_CHANGED'; end if;
  if p_action='save' then
    if p_tasks is null or jsonb_typeof(p_tasks)<>'array' then raise exception 'INVALID_TASKS'; end if;
    if jsonb_array_length(p_tasks) > 20 or octet_length(p_tasks::text)>30000 then raise exception 'INVALID_TASKS'; end if;
    for v_task in select value from jsonb_array_elements(p_tasks) loop
      if jsonb_typeof(v_task)<>'object' or jsonb_typeof(v_task->'title') is distinct from 'string'
        or char_length(btrim(v_task->>'title')) not between 1 and 160 then raise exception 'INVALID_TASKS'; end if;
      begin v_id := (v_task->>'id')::uuid;
      exception when invalid_text_representation then raise exception 'INVALID_TASKS'; end;
      if v_id is null or v_id=any(v_ids) then raise exception 'INVALID_TASKS'; end if;
      v_ids := array_append(v_ids,v_id);
      insert into public.daily_tasks(user_id,day,id,title,position)
        values(v_user,v_day,v_id,btrim(v_task->>'title'),v_position)
        on conflict(user_id,day,id) do update set title=excluded.title,position=excluded.position,
          completed_at=case when public.daily_tasks.title=excluded.title then public.daily_tasks.completed_at else null end,
          updated_at=clock_timestamp();
      v_position := v_position+1;
    end loop;
    delete from public.daily_tasks where user_id=v_user and day=v_day and not(id=any(v_ids));
  elsif p_action='check' then
    if p_completed is null then raise exception 'INVALID_TASKS'; end if;
    update public.daily_tasks set completed_at=case when p_completed then coalesce(completed_at,clock_timestamp()) else null end,updated_at=clock_timestamp()
      where user_id=v_user and day=v_day and id=p_task_id;
    if not found then raise exception 'TASK_NOT_FOUND'; end if;
  elsif p_action='finish' then
    -- Compatibility for a still-open old client: finishing never awards today's level.
    if not exists(select 1 from public.daily_tasks where user_id=v_user and day=v_day)
      or exists(select 1 from public.daily_tasks where user_id=v_user and day=v_day and completed_at is null) then raise exception 'TASKS_REMAIN'; end if;
  end if;
  if p_day is distinct from (clock_timestamp() at time zone 'Asia/Seoul')::date then raise exception 'DAY_CHANGED'; end if;
  update public.daily_plans set revision=revision+1,updated_at=clock_timestamp() where user_id=v_user and day=v_day;
  return public.daily_plan_state();
end;
$$;

commit;
