import { it, expect, vi } from 'vitest';
import { listContent } from '../lib/repository';
it('paginates deterministically rather than silently losing records at API row limits', async () => {
  const rows = Array.from({ length: 501 }, (_, i) => ({ id: String(i), title: '영상' }));
  const range = vi.fn((start: number, end: number) =>
    Promise.resolve({ data: rows.slice(start, end + 1), error: null }),
  );
  const query = {
    order: () => query,
    eq: () => query,
    range,
    then: (resolve: (v: unknown) => void) => resolve({ data: rows.slice(0, 500), error: null }),
  };
  const client = { from: () => ({ select: () => query }) };
  expect(await listContent(client as never, 'videos')).toHaveLength(501);
  expect(range).toHaveBeenCalledWith(0, 499);
  expect(range).toHaveBeenCalledWith(500, 999);
});
