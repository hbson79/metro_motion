import { it, expect, vi } from 'vitest';
import { saveContent, deleteContent } from '../lib/repository';
function client(dbError: unknown = null, cleanupError: unknown = null) {
  const remove = vi.fn().mockResolvedValue({ error: cleanupError });
  const upload = vi.fn().mockResolvedValue({ error: null });
  const single = vi.fn().mockResolvedValue({ data: { id: 'saved' }, error: dbError });
  const chain = {
    select: () => ({ single }),
    eq: () => ({
      select: () => ({ single }),
      then: (resolve: (v: unknown) => void) => resolve({ error: dbError }),
    }),
  };
  return {
    storage: { from: () => ({ upload, remove }) },
    from: () => ({
      insert: () => chain,
      update: () => chain,
      delete: () => ({ eq: () => ({ select: () => ({ single }) }) }),
    }),
    remove,
    upload,
    single,
  };
}
it('cleans uploaded asset when metadata insert fails', async () => {
  const c = client({ message: 'DB denied' });
  await expect(
    saveContent(
      c as never,
      'videos',
      { title: '밤', description: '', category: '도시', published: false },
      new File(['x'], 'a.mp4', { type: 'video/mp4' }),
    ),
  ).rejects.toThrow('DB denied');
  expect(c.remove).toHaveBeenCalledOnce();
});
it('retains previous file until replacement metadata is saved', async () => {
  const c = client({ message: 'DB denied' });
  await expect(
    saveContent(
      c as never,
      'videos',
      { title: '밤', description: '', category: '도시', published: false },
      new File(['x'], 'a.mp4', { type: 'video/mp4' }),
      { id: 'row', storage_path: 'old.mp4' } as never,
    ),
  ).rejects.toThrow();
  expect(c.remove.mock.calls[0][0]).not.toContain('old.mp4');
});
it('does not remove file when metadata deletion is denied', async () => {
  const c = client({ message: 'denied' });
  await expect(
    deleteContent(c as never, 'videos', { id: 'row', storage_path: 'old.mp4' } as never),
  ).rejects.toThrow();
  expect(c.remove).not.toHaveBeenCalled();
});
it('reports cleanup failures rather than silently claiming success', async () => {
  const c = client(null, { message: 'storage unavailable' });
  await expect(
    deleteContent(c as never, 'videos', { id: 'row', storage_path: 'old.mp4' } as never),
  ).rejects.toThrow('old.mp4');
});
