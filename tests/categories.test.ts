import { it, expect, vi } from 'vitest';
import * as repository from '../lib/repository';
it('rejects empty, reserved and overlong names before requesting writes', async () => {
  const from = vi.fn();
  for (const name of [' ', '전체', 'a'.repeat(41)])
    await expect(repository.saveCategory({ from } as never, name)).rejects.toThrow('카테고리');
  expect(from).not.toHaveBeenCalled();
});
it('lists all categories using stable paginated ordering', async () => {
  const names = Array.from({ length: 500 }, (_, i) => ({ name: `분류${i}` }));
  const range = vi
    .fn()
    .mockResolvedValueOnce({ data: names, error: null })
    .mockResolvedValueOnce({ data: [{ name: '여행' }], error: null });
  const order = vi.fn().mockReturnValue({ range });
  const from = vi.fn().mockReturnValue({ select: () => ({ order }) });
  expect(await repository.listCategories({ from } as never)).toEqual([
    ...names.map((row) => row.name),
    '여행',
  ]);
  expect(order).toHaveBeenCalledWith('name', { ascending: true });
  expect(range).toHaveBeenLastCalledWith(500, 999);
});
it('deletion verifies one affected category and translates in-use rejection', async () => {
  const single = vi
    .fn()
    .mockResolvedValueOnce({ data: { name: '여행' }, error: null })
    .mockResolvedValueOnce({ error: { code: '23503' } })
    .mockResolvedValueOnce({ error: { message: 'denied' } });
  const eq = vi.fn().mockReturnValue({ select: () => ({ single }) });
  const from = vi.fn().mockReturnValue({ delete: () => ({ eq }) });
  await repository.deleteCategory({ from } as never, '여행');
  expect(eq).toHaveBeenCalledWith('name', '여행');
  await expect(repository.deleteCategory({ from } as never, '도시')).rejects.toThrow('사용 중');
  await expect(repository.deleteCategory({ from } as never, '도시')).rejects.toThrow('denied');
});

it('saves category names through the categories table, not content or storage', async () => {
  const single = vi.fn().mockResolvedValue({ data: { name: '여행' }, error: null });
  const eq = vi.fn().mockReturnValue({ select: () => ({ single }) });
  const insert = vi.fn().mockReturnValue({ select: () => ({ single }) });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ insert, update });
  expect(await repository.saveCategory({ from } as never, ' 여행 ')).toBe('여행');
  expect(from).toHaveBeenCalledWith('categories');
  expect(insert).toHaveBeenCalledWith({ name: '여행' });
  await repository.saveCategory({ from } as never, '여행', '도시');
  expect(update).toHaveBeenCalledWith({ name: '여행' });
  expect(eq).toHaveBeenCalledWith('name', '도시');
});
