// @vitest-environment jsdom
import React from 'react';
import { it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import * as repository from '../lib/repository';
import Admin from '../components/Admin';
import Documents from '../components/Documents';
import Shorts from '../components/Shorts';
vi.mock('../lib/repository', async (importOriginal) => ({
  ...(await importOriginal<typeof repository>()),
  getClient: vi.fn(),
  checkAdmin: vi.fn(),
  listContent: vi.fn(),
  listCategories: vi.fn(),
  saveCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(repository.getClient).mockReturnValue({
    auth: {
      getUser: async () => ({ data: { user: { id: 'admin' } }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  } as never);
  vi.mocked(repository.checkAdmin).mockResolvedValue(true);
  vi.mocked(repository.listContent).mockResolvedValue([]);
  vi.mocked(repository.listCategories).mockResolvedValue(['여행']);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('admin manages categories and reloads the database list after saving', async () => {
  vi.mocked(repository.saveCategory).mockImplementation(async () => {
    vi.mocked(repository.listCategories).mockResolvedValue(['여행', '건축']);
    return '건축';
  });
  render(<Admin />);
  const manage = await screen.findByRole('button', { name: '카테고리 관리' });
  await waitFor(() => expect((manage as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(manage);
  fireEvent.change(await screen.findByLabelText('새 카테고리'), { target: { value: '건축' } });
  fireEvent.submit(screen.getByRole('form', { name: '카테고리 추가' }));
  await waitFor(() =>
    expect(repository.saveCategory).toHaveBeenCalledWith(expect.anything(), '건축', undefined),
  );
  expect(await screen.findByLabelText('건축 이름')).toBeTruthy();
  await waitFor(() => expect((manage as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: '카테고리 관리' }));
  fireEvent.click(screen.getByRole('button', { name: '새 콘텐츠' }));
  expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
    '여행',
    '건축',
  ]);
});
it.each([
  ['documents', Documents],
  ['videos', Shorts],
] as const)('%s renders managed public category filters', async (_, Component) => {
  render(<Component />);
  expect(await screen.findByRole('button', { name: '여행' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: '도시' })).toBeNull();
});
