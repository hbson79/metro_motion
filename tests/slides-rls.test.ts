import { beforeAll, afterAll, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

let db: PGlite;
const admin = '00000000-0000-0000-0000-000000000001';
const regular = '00000000-0000-0000-0000-000000000002';
let existing: unknown[];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    alter default privileges in schema public grant all on tables to anon,authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    grant usage on schema auth,storage to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to anon,authenticated;
    insert into auth.users values ('${admin}'),('${regular}');
  `);
  for (const file of ['001_initial.sql', '002_categories.sql', '003_document_images.sql'])
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
  await db.exec(`
    insert into admin_users(user_id) values('${admin}');
    insert into videos(title,category,storage_path,original_name,mime_type,size_bytes,published)
      values('기존 영상','도시','existing.mp4','existing.mp4','video/mp4',10,true);
    insert into documents(title,category,storage_path,original_name,mime_type,size_bytes,published)
      values('기존 사진','도시','existing.png','existing.png','image/png',10,true);
    insert into storage.buckets values('other','other',false,100,array['text/plain']);
    insert into storage.objects(bucket_id,name) values('metro-videos','existing.mp4'),('metro-documents','existing.png'),('other','public.html');
  `);
  existing = await snapshot();
  await db.exec(readFileSync('supabase/migrations/004_slides.sql', 'utf8'));
}, 20000);

afterAll(async () => {
  await db?.close();
});

async function as(role: string, id = '') {
  await db.exec(`reset role;set request.jwt.claim.sub='${id}';set role ${role};`);
}

async function insertSlide(path: string, published = false) {
  return db.query(
    `insert into slides(title,category,storage_path,original_name,mime_type,size_bytes,published)
     values('슬라이드','도시',$1,$1,'text/html',10,$2) returning *`,
    [path, published],
  );
}

async function snapshot() {
  const rows = [];
  for (const table of [
    'videos',
    'documents',
    'admin_users',
    'auth.users',
    'storage.buckets',
    'storage.objects',
  ])
    rows.push(
      (
        await db.query(
          `select * from ${table}${table === 'storage.buckets' ? " where id <> 'metro-slides'" : ''} order by 1`,
        )
      ).rows,
    );
  return rows;
}

it('adds a private HTML bucket without changing existing content, auth or buckets', async () => {
  const bucket = await db.query(`select * from storage.buckets where id='metro-slides'`);
  expect(bucket.rows).toEqual([
    {
      id: 'metro-slides',
      name: 'metro-slides',
      public: false,
      file_size_limit: 20971520,
      allowed_mime_types: ['text/html'],
    },
  ]);
  expect(await snapshot()).toEqual(existing);
  expect(
    (await db.query(`select relrowsecurity from pg_class where oid='public.slides'::regclass`))
      .rows,
  ).toEqual([{ relrowsecurity: true }]);
});

it('admin can create drafts, publish, edit, unpublish and delete slides and their objects', async () => {
  await as('authenticated', admin);
  const draft =
    await db.query(`insert into slides(title,category,storage_path,original_name,mime_type,size_bytes)
    values('슬라이드','도시','draft.htm','draft.htm','text/html',10) returning *`);
  expect(draft.rows[0]).toMatchObject({ title: '슬라이드', description: '', published: false });
  expect(draft.rows[0]).toHaveProperty('id');
  expect(draft.rows[0]).toHaveProperty('created_at');
  expect(draft.rows[0]).toHaveProperty('updated_at');
  await insertSlide('public.html', true);
  await db.exec(`insert into storage.objects(bucket_id,name) values
    ('metro-slides','public.html'),('metro-slides','draft.htm'),('metro-slides','orphan.html')`);
  expect(
    (await db.query(`select name from storage.objects where bucket_id='metro-slides'`)).rows,
  ).toHaveLength(3);
  await db.exec(`update slides set title='수정',published=true where storage_path='draft.htm'`);
  expect(
    (await db.query(`select title,published from slides where storage_path='draft.htm'`)).rows,
  ).toEqual([{ title: '수정', published: true }]);
  await db.exec(`update slides set published=false where storage_path='draft.htm'`);
  await insertSlide('temporary.html');
  await db.exec(
    `insert into storage.objects(bucket_id,name) values('metro-slides','temporary.html')`,
  );
  expect(
    (
      await db.query(
        `update storage.objects set name='renamed.html' where bucket_id='metro-slides' and name='temporary.html' returning name`,
      )
    ).rows,
  ).toEqual([{ name: 'renamed.html' }]);
  expect(
    (await db.query(`delete from slides where storage_path='temporary.html' returning id`)).rows,
  ).toHaveLength(1);
  expect(
    (
      await db.query(
        `delete from storage.objects where bucket_id='metro-slides' and name='renamed.html' returning id`,
      )
    ).rows,
  ).toHaveLength(1);
});

it('anonymous and ordinary users read only published slides and exact linked objects', async () => {
  for (const [role, id] of [
    ['anon', ''],
    ['authenticated', regular],
  ]) {
    await as(role, id);
    expect((await db.query('select storage_path from slides')).rows).toEqual([
      { storage_path: 'public.html' },
    ]);
    expect(
      (await db.query(`select name from storage.objects where bucket_id='metro-slides'`)).rows,
    ).toEqual([{ name: 'public.html' }]);
    expect(
      (await db.query(`select name from storage.objects where bucket_id='other'`)).rows,
    ).toHaveLength(0);
  }
});

it('blocks client writes and RLS-bypassing privileges including admin TRUNCATE', async () => {
  for (const [role, id] of [
    ['anon', ''],
    ['authenticated', regular],
  ]) {
    await as(role, id);
    await expect(insertSlide('attack.html', true)).rejects.toThrow();
    for (const sql of [
      `update slides set published=true returning id`,
      `delete from slides returning id`,
    ]) {
      if (role === 'anon') await expect(db.query(sql)).rejects.toThrow();
      else expect((await db.query(sql)).rows).toHaveLength(0);
    }
    await expect(
      db.exec(`insert into storage.objects(bucket_id,name) values('metro-slides','attack.html')`),
    ).rejects.toThrow();
    expect(
      (
        await db.query(
          `update storage.objects set name='attack.html' where bucket_id='metro-slides' returning id`,
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (await db.query(`delete from storage.objects where bucket_id='metro-slides' returning id`))
        .rows,
    ).toHaveLength(0);
    await expect(
      db.exec(`insert into admin_users(user_id) values('${regular}')`),
    ).rejects.toThrow();
  }
  for (const [role, id] of [
    ['anon', ''],
    ['authenticated', regular],
    ['authenticated', admin],
  ]) {
    await as(role, id);
    await expect(db.exec('truncate slides')).rejects.toThrow();
    const privileges = await db.query(`select
      has_table_privilege(current_user,'public.slides','TRUNCATE') as truncate,
      has_table_privilege(current_user,'public.slides','REFERENCES') as references,
      has_table_privilege(current_user,'public.slides','TRIGGER') as trigger`);
    expect(privileges.rows).toEqual([{ truncate: false, references: false, trigger: false }]);
  }
});

it('admin cannot move slide objects into an unrelated bucket', async () => {
  await as('authenticated', admin);
  await expect(
    db.exec(`insert into storage.objects(bucket_id,name) values('other','attack.html')`),
  ).rejects.toThrow();
  await expect(
    db.exec(
      `update storage.objects set bucket_id='other' where bucket_id='metro-slides' and name='orphan.html'`,
    ),
  ).rejects.toThrow();
  expect(
    (await db.query(`delete from storage.objects where bucket_id='other' returning id`)).rows,
  ).toHaveLength(0);
});

it('maintains updated_at automatically and indexes the public feed', async () => {
  await as('authenticated', admin);
  await db.exec(
    `update slides set updated_at='2000-01-01',title='자동 시간' where storage_path='draft.htm'`,
  );
  expect(
    (
      await db.query(
        `select updated_at > '2000-01-02'::timestamptz as touched from slides where storage_path='draft.htm'`,
      )
    ).rows,
  ).toEqual([{ touched: true }]);
  expect(
    (
      await db.query(
        `select indexdef from pg_indexes where tablename='slides' and indexname='slides_public_feed'`,
      )
    ).rows,
  ).toEqual([
    {
      indexdef:
        'CREATE INDEX slides_public_feed ON public.slides USING btree (published, created_at DESC)',
    },
  ]);
});

it('enforces HTML metadata bounds, paths, MIME, uniqueness and required fields', async () => {
  await as('authenticated', admin);
  const invalid: [string, unknown][] = [
    ['title', ''],
    ['title', '   '],
    ['title', 'x'.repeat(121)],
    ['description', 'x'.repeat(4001)],
    ['category', '없는 분류'],
    ['storage_path', '../attack.html'],
    ['storage_path', 'nested/file.html'],
    ['storage_path', 'attack.svg'],
    ['storage_path', 'attack.html.exe'],
    ['storage_path', 'attack.HTML'],
    ['storage_path', 'public.html'],
    ['original_name', ''],
    ['original_name', 'x'.repeat(256)],
    ['mime_type', 'text/plain'],
    ['mime_type', 'application/xhtml+xml'],
    ['size_bytes', 0],
    ['size_bytes', -1],
    ['size_bytes', 20971521],
  ];
  for (const [column, value] of invalid)
    await expect(
      db.query(`update slides set ${column}=$1 where storage_path='draft.htm'`, [value]),
    ).rejects.toThrow();
  for (const column of [
    'title',
    'description',
    'category',
    'storage_path',
    'original_name',
    'mime_type',
    'size_bytes',
    'published',
    'created_at',
  ])
    await expect(
      db.exec(`update slides set ${column}=null where storage_path='draft.htm'`),
    ).rejects.toThrow();
  await db.query(
    `update slides set title=$1,description=$2,original_name=$3,size_bytes=20971520 where storage_path='draft.htm'`,
    ['x'.repeat(120), 'x'.repeat(4000), 'x'.repeat(255)],
  );
  await db.exec(`update slides set size_bytes=1 where storage_path='draft.htm'`);
});

it('cascades category renames into slides while restricting deletion of referenced categories', async () => {
  await as('authenticated', admin);
  await db.exec(`update categories set name='도시 풍경' where name='도시'`);
  for (const table of ['videos', 'documents', 'slides'])
    expect((await db.query(`select distinct category from ${table}`)).rows).toEqual([
      { category: '도시 풍경' },
    ]);
  await expect(db.exec(`delete from categories where name='도시 풍경'`)).rejects.toThrow();
  await db.exec(`update categories set name='도시' where name='도시 풍경'`);
});

it('unpublishing prevents new anonymous row and object reads', async () => {
  await as('authenticated', admin);
  await db.exec(`update slides set published=false where storage_path='public.html'`);
  await as('anon');
  expect((await db.query('select * from slides')).rows).toHaveLength(0);
  expect(
    (await db.query(`select * from storage.objects where bucket_id='metro-slides'`)).rows,
  ).toHaveLength(0);
  await as('authenticated', admin);
  await db.exec(`update slides set published=true where storage_path='public.html'`);
});
