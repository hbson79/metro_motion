import { it, expect, vi } from 'vitest';
import { signedUrl } from '../lib/repository';
it('issues short-lived HTTPS reading URLs from namespaced private buckets', async () => {
  const createSignedUrl = vi
    .fn()
    .mockResolvedValue({ data: { signedUrl: 'https://example.test/file' }, error: null });
  const from = vi.fn().mockReturnValue({ createSignedUrl });
  const client = { storage: { from } };
  expect(await signedUrl(client as never, 'videos', 'file.mp4')).toBe('https://example.test/file');
  expect(from).toHaveBeenCalledWith('metro-videos');
  expect(createSignedUrl).toHaveBeenCalledWith('file.mp4', 300, undefined);
});
it('rejects malicious signing response instead of navigating unsafe links', async () => {
  const client = {
    storage: {
      from: () => ({
        createSignedUrl: () =>
          Promise.resolve({ data: { signedUrl: 'javascript:alert(1)' }, error: null }),
      }),
    },
  };
  await expect(signedUrl(client as never, 'documents', 'file.pdf')).rejects.toThrow(
    '안전하지 않은',
  );
});
