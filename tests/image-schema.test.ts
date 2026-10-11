import { beforeAll, afterAll, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
let db: PGlite;
const admin = '00000000-0000-0000-0000-000000000001';
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,storage to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to anon,authenticated;
    insert into auth.users values ('${admin}');`);
  await db.exec(readFileSync('supabase/migrations/001_initial.sql', 'utf8'));
  await db.exec(`insert into public.admin_users(user_id) values('${admin}');`);
  await db.exec(readFileSync('supabase/migrations/003_document_images.sql', 'utf8'));
}, 20000);
afterAll(async () => {
  await db?.close();
});
it('allows image records and bucket MIME while retaining private published-only access', async () => {
  const bucket = (
    await db.query<{ public: boolean; file_size_limit: number; allowed_mime_types: string[] }>(
      "select public,file_size_limit,allowed_mime_types from storage.buckets where id='metro-documents'",
    )
  ).rows[0];
  expect(bucket.public).toBe(false);
  expect(Number(bucket.file_size_limit)).toBe(20971520);
  expect(bucket.allowed_mime_types).toEqual(
    expect.arrayContaining([
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/webp',
    ]),
  );
  await db.exec(`set request.jwt.claim.sub='${admin}'; set role authenticated;`);
  for (const [ext, mime] of [
    ['jpg', 'image/jpeg'],
    ['jpeg', 'image/jpeg'],
    ['png', 'image/png'],
    ['webp', 'image/webp'],
  ]) {
    await db.query(
      `insert into documents(title,category,storage_path,original_name,mime_type,size_bytes,published) values('사진','도시',$1,$1,$2,10,$3)`,
      [`photo.${ext}`, mime, ext === 'jpg'],
    );
    await db.query("insert into storage.objects(bucket_id,name) values('metro-documents',$1)", [
      `photo.${ext}`,
    ]);
  }
  for (const [path, mime] of [
    ['bad.svg', 'image/svg+xml'],
    ['bad.exe', 'image/jpeg'],
  ])
    await expect(
      db.query(
        `insert into documents(title,category,storage_path,original_name,mime_type,size_bytes) values('차단','도시',$1,$1,$2,10)`,
        [path, mime],
      ),
    ).rejects.toThrow();
  await db.exec("reset role;set request.jwt.claim.sub='';set role anon;");
  expect((await db.query('select storage_path from documents')).rows).toEqual([
    { storage_path: 'photo.jpg' },
  ]);
  expect((await db.query('select name from storage.objects')).rows).toEqual([
    { name: 'photo.jpg' },
  ]);
  await db.exec('reset role;set role authenticated;');
  await expect(
    db.exec("insert into storage.objects(bucket_id,name) values('metro-documents','attack.jpg')"),
  ).rejects.toThrow();
  expect((await db.query('update documents set published=true returning id')).rows).toHaveLength(0);
  await db.exec('reset role;');
  expect(
    (await db.query("select allowed_mime_types from storage.buckets where id='metro-videos'")).rows,
  ).toEqual([{ allowed_mime_types: ['video/mp4', 'video/webm'] }]);
});
