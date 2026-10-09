import { beforeAll, afterAll, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, existsSync } from 'node:fs';
let db: PGlite;
const admin = '00000000-0000-0000-0000-000000000001',
  regular = '00000000-0000-0000-0000-000000000002';
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; alter default privileges in schema public grant all on tables to anon,authenticated; create schema auth; create schema storage; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth,storage to anon,authenticated; grant execute on function auth.uid() to anon,authenticated; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text); alter table storage.objects enable row level security; grant select,insert,update,delete on storage.objects to anon,authenticated; insert into auth.users values ('${admin}'),('${regular}');`,
  );
  await db.exec(readFileSync('supabase/migrations/001_initial.sql', 'utf8'));
  if (existsSync('supabase/migrations/002_categories.sql'))
    await db.exec(readFileSync('supabase/migrations/002_categories.sql', 'utf8'));
  await db.exec(
    `insert into public.admin_users(user_id) values('${admin}');insert into public.videos(title,category,storage_path,original_name,mime_type,size_bytes,published) values ('공개','도시','public.mp4','p.mp4','video/mp4',10,true),('비공개','도시','private.mp4','p.mp4','video/mp4',10,false);insert into public.documents(title,category,storage_path,original_name,mime_type,size_bytes,published) values('공개 문서','도시','public.pdf','p.pdf','application/pdf',10,true),('비공개 문서','도시','private.pdf','p.pdf','application/pdf',10,false);insert into storage.objects(bucket_id,name) values('metro-videos','public.mp4'),('metro-videos','private.mp4'),('metro-documents','public.pdf'),('metro-documents','private.pdf');`,
  );
}, 20000);
afterAll(async () => {
  await db?.close();
});
async function as(role: string, id = '') {
  await db.exec(`reset role;set request.jwt.claim.sub='${id}';set role ${role};`);
}
it('admin renames a category atomically across videos and documents', async () => {
  await as('authenticated', admin);
  await db.exec(`update categories set name='도시 풍경' where name='도시'`);
  expect((await db.query('select distinct category from videos')).rows).toEqual([
    { category: '도시 풍경' },
  ]);
  expect((await db.query('select distinct category from documents')).rows).toEqual([
    { category: '도시 풍경' },
  ]);
  await db.exec(`update categories set name='도시' where name='도시 풍경'`);
});
it('categories are publicly readable but only admins can create, rename and delete', async () => {
  await as('anon');
  expect((await db.query('select name from categories')).rows).toHaveLength(5);
  await expect(db.exec(`insert into categories(name) values('공격')`)).rejects.toThrow();
  await expect(db.exec('truncate categories')).rejects.toThrow();
  await as('authenticated', regular);
  await expect(db.exec(`insert into categories(name) values('공격')`)).rejects.toThrow();
  expect(
    (await db.query(`update categories set name='공격' where name='도시' returning name`)).rows,
  ).toHaveLength(0);
  expect(
    (await db.query(`delete from categories where name='도시' returning name`)).rows,
  ).toHaveLength(0);
  await expect(db.exec('truncate categories')).rejects.toThrow();
  await as('authenticated', admin);
  await db.exec(`insert into categories(name) values('여행')`);
  await expect(db.exec(`insert into categories(name) values('여행')`)).rejects.toThrow();
  for (const name of ['', '전체', ' 여백 ', 'x'.repeat(41)])
    await expect(db.query('insert into categories(name) values($1)', [name])).rejects.toThrow();
  await db.exec(`delete from categories where name='여행'`);
  await expect(db.exec(`delete from categories where name='도시'`)).rejects.toThrow();
  await expect(db.exec(`update categories set name='자연' where name='도시'`)).rejects.toThrow();
  expect((await db.query(`select distinct category from videos`)).rows).toEqual([
    { category: '도시' },
  ]);
  await expect(db.exec(`update videos set category='등록되지 않음'`)).rejects.toThrow();
});
it('anonymous can read only published rows and corresponding private bucket objects', async () => {
  await as('anon');
  expect((await db.query('select * from videos')).rows).toHaveLength(1);
  expect((await db.query('select * from documents')).rows).toHaveLength(1);
  expect((await db.query('select * from storage.objects')).rows).toHaveLength(2);
});
it('ordinary user cannot self-grant admin or upload or publish', async () => {
  await as('authenticated', regular);
  await expect(db.exec(`insert into admin_users(user_id) values('${regular}')`)).rejects.toThrow();
  await expect(
    db.exec(`insert into storage.objects(bucket_id,name) values('metro-videos','attack.mp4')`),
  ).rejects.toThrow();
  expect((await db.query('update videos set published=true returning id')).rows).toHaveLength(0);
});
it('admin can read drafts and publish, unpublish, edit, upload and delete', async () => {
  await as('authenticated', admin);
  expect((await db.query('select * from videos')).rows).toHaveLength(2);
  expect((await db.query('select * from storage.objects')).rows).toHaveLength(4);
  await db.exec(
    `update videos set published=true where storage_path='private.mp4';update videos set title='수정',published=false where storage_path='private.mp4';insert into storage.objects(bucket_id,name) values('metro-videos','new.mp4');delete from storage.objects where name='new.mp4';`,
  );
  expect(
    (await db.query(`select title from videos where storage_path='private.mp4'`)).rows[0],
  ).toEqual({ title: '수정' });
});
it('revokes inherited excessive grants including TRUNCATE which bypasses RLS', async () => {
  await as('anon');
  await expect(db.exec('truncate public.videos')).rejects.toThrow();
  await expect(db.exec('truncate public.documents')).rejects.toThrow();
  await as('authenticated', regular);
  await expect(db.exec('truncate public.videos')).rejects.toThrow();
});
it('unpublish revokes new anonymous object reads', async () => {
  await as('anon');
  expect(
    (await db.query(`select * from storage.objects where name='private.mp4'`)).rows,
  ).toHaveLength(0);
});
