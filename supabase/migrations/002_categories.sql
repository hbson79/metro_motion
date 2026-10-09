-- Apply once AFTER 001_initial.sql. Preserves content and storage objects.
begin;
create table public.categories (
 name text primary key check(name = trim(name) and char_length(name) between 1 and 40 and name <> '전체'),
 created_at timestamptz not null default now()
);
insert into public.categories(name) values ('도시'),('자연'),('라이프'),('브랜드'),('아트');
insert into public.categories(name)
 select category from public.videos union select category from public.documents
 on conflict (name) do nothing;
alter table public.categories enable row level security;
revoke all on public.categories from anon,authenticated;
grant select on public.categories to anon,authenticated;
grant insert,update,delete on public.categories to authenticated;
create policy categories_read on public.categories for select to anon,authenticated using(true);
create policy categories_insert on public.categories for insert to authenticated with check((select public.is_admin()));
create policy categories_update on public.categories for update to authenticated using((select public.is_admin())) with check((select public.is_admin()));
create policy categories_delete on public.categories for delete to authenticated using((select public.is_admin()));
alter table public.videos drop constraint videos_category_check;
alter table public.documents drop constraint documents_category_check;
alter table public.videos add constraint videos_category_fkey foreign key(category) references public.categories(name) on update cascade on delete restrict;
alter table public.documents add constraint documents_category_fkey foreign key(category) references public.categories(name) on update cascade on delete restrict;
commit;
