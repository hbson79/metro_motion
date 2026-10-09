-- Run once in a new Supabase project's SQL Editor as postgres.
begin;
create table public.admin_users (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to authenticated;
create policy admin_own_membership on public.admin_users for select to authenticated using (user_id=(select auth.uid()));
-- No INSERT/UPDATE/DELETE grants or policies: a client cannot self-grant.
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.admin_users where user_id=(select auth.uid()));
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon,authenticated;

create table public.videos (
 id uuid primary key default gen_random_uuid(),
 title text not null check(char_length(trim(title)) between 1 and 120),
 description text not null default '' check(char_length(description)<=4000),
 category text not null check(category in ('도시','자연','라이프','브랜드','아트')),
 storage_path text not null unique check(storage_path ~ '^[A-Za-z0-9_-]+\.(mp4|webm)$'),
 original_name text not null check(char_length(original_name) between 1 and 255),
 mime_type text not null check(mime_type in ('video/mp4','video/webm')),
 size_bytes bigint not null check(size_bytes>0 and size_bytes<=262144000),
 published boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.documents (
 id uuid primary key default gen_random_uuid(),
 title text not null check(char_length(trim(title)) between 1 and 120),
 description text not null default '' check(char_length(description)<=4000),
 category text not null check(category in ('도시','자연','라이프','브랜드','아트')),
 storage_path text not null unique check(storage_path ~ '^[A-Za-z0-9_-]+\.(pdf|txt|docx)$'),
 original_name text not null check(char_length(original_name) between 1 and 255),
 mime_type text not null check(mime_type in ('application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
 size_bytes bigint not null check(size_bytes>0 and size_bytes<=20971520),
 published boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create function public.touch_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now();return new;end $$;
create trigger videos_updated before update on public.videos for each row execute function public.touch_updated_at();
create trigger documents_updated before update on public.documents for each row execute function public.touch_updated_at();
create index videos_public_feed on public.videos (published,created_at desc);
create index documents_public_feed on public.documents (published,created_at desc);
alter table public.videos enable row level security;
alter table public.documents enable row level security;
revoke all on public.videos,public.documents from anon,authenticated;
grant select on public.videos,public.documents to anon,authenticated;
grant insert,update,delete on public.videos,public.documents to authenticated;
create policy videos_read on public.videos for select to anon,authenticated using(published or (select public.is_admin()));
create policy videos_insert on public.videos for insert to authenticated with check((select public.is_admin()));
create policy videos_update on public.videos for update to authenticated using((select public.is_admin())) with check((select public.is_admin()));
create policy videos_delete on public.videos for delete to authenticated using((select public.is_admin()));
create policy documents_read on public.documents for select to anon,authenticated using(published or (select public.is_admin()));
create policy documents_insert on public.documents for insert to authenticated with check((select public.is_admin()));
create policy documents_update on public.documents for update to authenticated using((select public.is_admin())) with check((select public.is_admin()));
create policy documents_delete on public.documents for delete to authenticated using((select public.is_admin()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('metro-videos','metro-videos',false,262144000,array['video/mp4','video/webm']),
 ('metro-documents','metro-documents',false,20971520,array['application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
create policy metro_objects_read on storage.objects for select to anon,authenticated using(
 bucket_id in ('metro-videos','metro-documents') and (
 (select public.is_admin()) or
 (bucket_id='metro-videos' and exists(select 1 from public.videos v where v.storage_path=name and v.published)) or
 (bucket_id='metro-documents' and exists(select 1 from public.documents d where d.storage_path=name and d.published))
 ));
create policy metro_objects_insert on storage.objects for insert to authenticated with check(bucket_id in ('metro-videos','metro-documents') and (select public.is_admin()));
create policy metro_objects_update on storage.objects for update to authenticated using(bucket_id in ('metro-videos','metro-documents') and (select public.is_admin())) with check(bucket_id in ('metro-videos','metro-documents') and (select public.is_admin()));
create policy metro_objects_delete on storage.objects for delete to authenticated using(bucket_id in ('metro-videos','metro-documents') and (select public.is_admin()));
commit;
