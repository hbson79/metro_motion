-- Apply once AFTER 001, 002 and 003 with project-owner approval.
-- Adds HTML slides only; preserves existing content, Auth, buckets and policies.
begin;
create table public.slides (
 id uuid primary key default gen_random_uuid(),
 title text not null check(char_length(trim(title)) between 1 and 120),
 description text not null default '' check(char_length(description)<=4000),
 category text not null references public.categories(name) on update cascade on delete restrict,
 storage_path text not null unique check(storage_path ~ '^[A-Za-z0-9_-]+\.(html|htm)$'),
 original_name text not null check(char_length(original_name) between 1 and 255),
 mime_type text not null check(mime_type='text/html'),
 size_bytes bigint not null check(size_bytes>0 and size_bytes<=20971520),
 published boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create trigger slides_updated before update on public.slides for each row execute function public.touch_updated_at();
create index slides_public_feed on public.slides (published,created_at desc);
alter table public.slides enable row level security;
-- Revoke excessive project defaults, including TRUNCATE (which bypasses RLS).
revoke all on public.slides from anon,authenticated;
grant select on public.slides to anon,authenticated;
grant insert,update,delete on public.slides to authenticated;
create policy slides_read on public.slides for select to anon,authenticated using(published or (select public.is_admin()));
create policy slides_insert on public.slides for insert to authenticated with check((select public.is_admin()));
create policy slides_update on public.slides for update to authenticated using((select public.is_admin())) with check((select public.is_admin()));
create policy slides_delete on public.slides for delete to authenticated using((select public.is_admin()));
-- Separate, bucket-scoped policies leave existing Storage policies/grants intact.
create policy metro_slides_objects_read on storage.objects for select to anon,authenticated using(
 bucket_id='metro-slides' and (
 (select public.is_admin()) or
 exists(select 1 from public.slides s where s.storage_path=name and s.published)
 ));
create policy metro_slides_objects_insert on storage.objects for insert to authenticated with check(bucket_id='metro-slides' and (select public.is_admin()));
create policy metro_slides_objects_update on storage.objects for update to authenticated using(bucket_id='metro-slides' and (select public.is_admin())) with check(bucket_id='metro-slides' and (select public.is_admin()));
create policy metro_slides_objects_delete on storage.objects for delete to authenticated using(bucket_id='metro-slides' and (select public.is_admin()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('metro-slides','metro-slides',false,20971520,array['text/html']);
commit;
