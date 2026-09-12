begin;

create table if not exists public.library_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  kind text not null check (kind in ('link','pdf','image')),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  notes text not null default '' check (char_length(notes) <= 4000),
  url text,
  storage_path text,
  file_name text,
  mime_type text,
  file_size bigint,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,id),
  check (
    (kind = 'link' and url is not null and url ~ '^https?://' and char_length(url) <= 2048
      and storage_path is null and file_name is null and mime_type is null and file_size is null)
    or
    (kind in ('pdf','image') and url is null and file_name is not null
      and char_length(file_name) between 1 and 255 and file_size is not null and file_size between 1 and 20971520
      and mime_type is not null and storage_path is not null
      and ((kind = 'pdf' and mime_type = 'application/pdf')
        or (kind = 'image' and mime_type in ('image/jpeg','image/png','image/webp','image/gif','image/avif')))
      and storage_path = user_id::text || '/' || id::text || '.' ||
        case mime_type when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg'
          when 'image/png' then 'png' when 'image/webp' then 'webp'
          when 'image/gif' then 'gif' when 'image/avif' then 'avif' end)
  )
);
alter table public.library_items enable row level security;
revoke all on public.library_items from anon, authenticated;
grant usage on schema public to authenticated;
grant select, insert, update on public.library_items to authenticated;
drop policy if exists library_select_own on public.library_items;
create policy library_select_own on public.library_items for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists library_insert_own on public.library_items;
create policy library_insert_own on public.library_items for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists library_update_own on public.library_items;
create policy library_update_own on public.library_items for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create index if not exists library_items_user_created on public.library_items(user_id,created_at desc,id);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('library-files','library-files',false,20971520,
  array['application/pdf','image/jpeg','image/png','image/webp','image/gif','image/avif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists library_files_select_own on storage.objects;
create policy library_files_select_own on storage.objects for select to authenticated
  using (bucket_id = 'library-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists library_files_insert_own on storage.objects;
create policy library_files_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'library-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists library_files_update_own on storage.objects;
create policy library_files_update_own on storage.objects for update to authenticated
  using (bucket_id = 'library-files' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'library-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
commit;
