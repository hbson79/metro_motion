import { it, expect, vi } from 'vitest';
import { saveContent } from '../lib/repository';
it('compensates uploaded file even when SDK rejects metadata request', async () => {
  const remove = vi.fn().mockResolvedValue({ error: null });
  const client = {
    storage: { from: () => ({ upload: () => Promise.resolve({ error: null }), remove }) },
    from: () => ({
      insert: () => ({
        select: () => ({ single: () => Promise.reject(new Error('connection interrupted')) }),
      }),
    }),
  };
  await expect(
    saveContent(
      client as never,
      'videos',
      { title: '모션', description: '', category: '도시', published: false },
      new File(['x'], 'movie.mp4', { type: 'video/mp4' }),
    ),
  ).rejects.toThrow('connection interrupted');
  expect(remove).toHaveBeenCalledOnce();
});
it('marks committed saves when old object removal fails so retry cannot duplicate the save', async () => {
  const client = {
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ error: null }),
        remove: () => Promise.resolve({ error: { message: 'offline' } }),
      }),
    },
    from: () => ({
      update: () => ({
        eq: () => ({
          select: () => ({ single: () => Promise.resolve({ data: { id: 'saved' }, error: null }) }),
        }),
      }),
    }),
  };
  try {
    await saveContent(
      client as never,
      'videos',
      { title: '모션', description: '', category: '도시', published: false },
      new File(['x'], 'movie.mp4', { type: 'video/mp4' }),
      { id: 'saved', storage_path: 'old.mp4' } as never,
    );
    throw new Error('expected cleanup failure');
  } catch (e) {
    expect(e).toHaveProperty('committed', true);
    expect((e as Error).message).toContain('old.mp4');
  }
});
