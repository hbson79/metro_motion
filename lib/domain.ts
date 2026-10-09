export type Kind = 'videos' | 'documents';
export type Content = {
  id: string;
  title: string;
  description: string;
  category: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  published: boolean;
  created_at: string;
  updated_at: string;
};
export const CATEGORIES = ['전체', '도시', '자연', '라이프', '브랜드', '아트'];
export const LIMITS = { videos: 250 * 1024 * 1024, documents: 20 * 1024 * 1024 };
export function validateUpload(
  file: Pick<File, 'name' | 'type' | 'size'>,
  kind: Kind,
): string | null {
  const allowed =
    kind === 'videos'
      ? { 'video/mp4': ['mp4'], 'video/webm': ['webm'] }
      : {
          'application/pdf': ['pdf'],
          'text/plain': ['txt'],
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
        };
  const extensions = allowed[file.type as keyof typeof allowed] as string[] | undefined;
  if (!extensions?.includes(file.name.split('.').pop()?.toLowerCase() || ''))
    return '지원하지 않는 파일 형식입니다.';
  if (file.size <= 0 || file.size > LIMITS[kind])
    return `파일 크기는 0보다 크고 ${LIMITS[kind] / 1024 / 1024}MB 이하여야 합니다.`;
  return null;
}
export function filterContent<T extends { title: string; description: string; category: string }>(
  rows: T[],
  search: string,
  category: string,
): T[] {
  const q = search.trim().toLocaleLowerCase();
  return rows.filter(
    (r) =>
      (category === '전체' || r.category === category) &&
      `${r.title} ${r.description}`.toLocaleLowerCase().includes(q),
  );
}
export function safeUrl(value: string): string | null {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password ? u.href : null;
  } catch {
    return null;
  }
}
export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : typeof error === 'object' && error && 'message' in error
      ? String(error.message)
      : '요청을 처리하지 못했습니다. 다시 시도해 주세요.';
}
