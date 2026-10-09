import { it, expect, vi } from 'vitest';
import { deleteContent } from '../lib/repository';
it('requires delete returning exactly one record before touching its file', async () => {
  const remove = vi.fn().mockResolvedValue({ error: null });
  const query = {
    select: () => ({
      single: () => Promise.resolve({ data: null, error: { message: '0 rows returned' } }),
    }),
    then: (resolve: (v: unknown) => void) => resolve({ error: null }),
  };
  const client = {
    from: () => ({ delete: () => ({ eq: () => query }) }),
    storage: { from: () => ({ remove }) },
  };
  await expect(
    deleteContent(client as never, 'videos', { id: 'missing', storage_path: 'keep.mp4' } as never),
  ).rejects.toThrow('0 rows');
  expect(remove).not.toHaveBeenCalled();
});
