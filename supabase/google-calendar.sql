begin;

-- Credentials are AES-GCM encrypted by the Edge Function. No browser role can read them.
create table if not exists public.google_calendar_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  credentials text not null,
  email text not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.google_calendar_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  verifier text not null,
  origin text not null,
  expires_at timestamptz not null
);
alter table public.google_calendar_connections enable row level security;
alter table public.google_calendar_oauth_states enable row level security;
revoke all on public.google_calendar_connections from public, anon, authenticated;
revoke all on public.google_calendar_oauth_states from public, anon, authenticated;
grant select, insert, update, delete on public.google_calendar_connections to service_role;
grant select, insert, update, delete on public.google_calendar_oauth_states to service_role;
create index if not exists google_calendar_oauth_expiry on public.google_calendar_oauth_states(expires_at);

-- Atomic consumption prevents replay and leaves another user's state untouched.
create or replace function public.consume_google_calendar_state(p_hash text, p_user uuid)
returns table(verifier text, origin text)
language sql security invoker set search_path = '' as $$
  delete from public.google_calendar_oauth_states s
  where s.state_hash = p_hash and s.user_id = p_user and s.expires_at > now()
  returning s.verifier, s.origin;
$$;
revoke all on function public.consume_google_calendar_state(text, uuid) from public, anon, authenticated;
grant execute on function public.consume_google_calendar_state(text, uuid) to service_role;

commit;
