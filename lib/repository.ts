import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { type Kind, type Content, validateUpload, errorMessage, safeUrl } from './domain';
export class CommittedCleanupError extends Error {
  readonly committed = true;
}
let instance: SupabaseClient | null = null;
export function getClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !safeUrl(url)) return null;
  return (instance ??= createClient(url, key));
}
export async function listContent(
  client: SupabaseClient,
  kind: Kind,
  admin = false,
): Promise<Content[]> {
  const collected = new Map<string, Content>();
  const pageSize = 500;
  for (let start = 0; ; start += pageSize) {
    let q = client
      .from(kind)
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });
    if (!admin) q = q.eq('published', true);
    const { data, error } = await q.range(start, start + pageSize - 1);
    if (error) throw error;
    for (const row of (data || []) as Content[]) collected.set(row.id, row);
    if (!data || data.length < pageSize) break;
  }
  return [...collected.values()];
}
export async function signedUrl(
  client: SupabaseClient,
  kind: Kind,
  path: string,
  download?: string,
): Promise<string> {
  const { data, error } = await client.storage
    .from(`metro-${kind}`)
    .createSignedUrl(path, 300, download ? { download } : undefined);
  if (error) throw error;
  const url = safeUrl(data.signedUrl);
  if (!url) throw new Error('안전하지 않은 파일 주소입니다.');
  return url;
}
export type ContentInput = Pick<Content, 'title' | 'description' | 'category' | 'published'>;
export async function saveContent(
  client: SupabaseClient,
  kind: Kind,
  input: ContentInput,
  file: File | null,
  existing?: Content,
): Promise<Content> {
  if (!input.title.trim() || input.title.length > 120 || input.description.length > 4000)
    throw new Error('제목은 1–120자, 설명은 4,000자 이하여야 합니다.');
  if (!existing && !file) throw new Error('파일을 선택해 주세요.');
  let uploaded: string | undefined;
  if (file) {
    const invalid = validateUpload(file, kind);
    if (invalid) throw new Error(invalid);
    uploaded = `${crypto.randomUUID()}.${file.name.split('.').pop()!.toLowerCase()}`;
    const { error } = await client.storage
      .from(`metro-${kind}`)
      .upload(uploaded, file, { contentType: file.type, upsert: false });
    if (error) throw error;
  }
  const payload = {
    ...input,
    title: input.title.trim(),
    ...(uploaded && file
      ? {
          storage_path: uploaded,
          original_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        }
      : {}),
  };
  const operation = existing
    ? client.from(kind).update(payload).eq('id', existing.id)
    : client.from(kind).insert(payload);
  let saved: Content;
  try {
    const { data, error } = await operation.select().single();
    if (error) throw error;
    saved = data as Content;
  } catch (error) {
    if (uploaded) {
      try {
        const cleanup = await client.storage.from(`metro-${kind}`).remove([uploaded]);
        if (cleanup.error) throw cleanup.error;
      } catch (cleanupError) {
        throw new Error(
          `${errorMessage(error)} 업로드 잔여 파일 정리 실패: ${uploaded}. ${errorMessage(cleanupError)}`,
        );
      }
    }
    throw error;
  }
  if (uploaded && existing) {
    try {
      const { error } = await client.storage.from(`metro-${kind}`).remove([existing.storage_path]);
      if (error) throw error;
    } catch (cleanupError) {
      throw new CommittedCleanupError(
        `저장은 완료했지만 이전 파일 정리 실패: ${existing.storage_path}. ${errorMessage(cleanupError)}`,
      );
    }
  }
  return saved;
}
export async function deleteContent(
  client: SupabaseClient,
  kind: Kind,
  row: Content,
): Promise<void> {
  const { error } = await client.from(kind).delete().eq('id', row.id).select('id').single();
  if (error) throw error;
  const { error: cleanupError } = await client.storage
    .from(`metro-${kind}`)
    .remove([row.storage_path]);
  if (cleanupError)
    throw new Error(
      `목록 삭제는 완료했지만 파일 정리 실패: ${row.storage_path}. ${errorMessage(cleanupError)}`,
    );
}
export async function setPublished(
  client: SupabaseClient,
  kind: Kind,
  id: string,
  published: boolean,
) {
  const { data, error } = await client
    .from(kind)
    .update({ published })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Content;
}
export async function checkAdmin(client: SupabaseClient): Promise<boolean> {
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || !user) return false;
  const { data, error } = await client
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
