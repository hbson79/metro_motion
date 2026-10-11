// @vitest-environment jsdom
import React from 'react';
import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { DocumentDetail } from '../components/Documents';
const boundary = vi.hoisted(() => ({ signedUrl: vi.fn(), row: {} as Record<string, unknown> }));
vi.mock('../lib/repository', async (importOriginal) => {
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: boundary.row, error: null }),
          }),
        }),
      }),
    }),
  };
  return {
    ...(await importOriginal<typeof import('../lib/repository')>()),
    signedUrl: boundary.signedUrl,
    getClient: () => client,
  };
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function record(mime = 'image/jpeg', name = 'photo.jpg') {
  boundary.row = {
    id: 'photo-id',
    title: '도시 사진',
    description: '풍경',
    category: '도시',
    storage_path: name,
    original_name: name,
    mime_type: mime,
    size_bytes: 100,
    published: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };
}
it.each([
  ['image/jpeg', 'photo.jpg'],
  ['image/jpeg', 'photo.jpeg'],
  ['image/png', 'photo.png'],
  ['image/webp', 'photo.webp'],
])('automatically previews %s without requesting attachment download', async (mime, name) => {
  record(mime, name);
  boundary.signedUrl.mockResolvedValue('https://example.test/signed-photo');
  render(<DocumentDetail id="photo-id" />);
  const image = await screen.findByRole('img', { name: '도시 사진' });
  expect(image.getAttribute('src')).toBe('https://example.test/signed-photo');
  expect(boundary.signedUrl).toHaveBeenCalledWith(expect.anything(), 'documents', name);
  expect(screen.getByRole('button', { name: '문서 다운로드' })).toBeTruthy();
});
it.each(['application/pdf', 'image/svg+xml', 'text/html'])('does not embed %s', async (mime) => {
  record(mime, 'file.pdf');
  render(<DocumentDetail id="photo-id" />);
  await screen.findByRole('heading', { name: '도시 사진' });
  expect(screen.queryByRole('img')).toBeNull();
  expect(boundary.signedUrl).not.toHaveBeenCalled();
});
it('shows signing errors and retries preview without a download', async () => {
  record();
  boundary.signedUrl
    .mockRejectedValueOnce(new Error('접근 거부'))
    .mockResolvedValue('https://example.test/retry');
  render(<DocumentDetail id="photo-id" />);
  expect((await screen.findByRole('alert')).textContent).toContain('접근 거부');
  fireEvent.click(screen.getByRole('button', { name: '이미지 다시 시도' }));
  await screen.findByRole('img', { name: '도시 사진' });
  expect(boundary.signedUrl).toHaveBeenCalledTimes(2);
});
it('shows image-load failures and can request a fresh signed URL', async () => {
  record();
  boundary.signedUrl.mockResolvedValue('https://example.test/image');
  render(<DocumentDetail id="photo-id" />);
  fireEvent.error(await screen.findByRole('img', { name: '도시 사진' }));
  expect(screen.getByRole('alert').textContent).toContain('이미지를 불러오지 못했습니다');
  fireEvent.click(screen.getByRole('button', { name: '이미지 다시 시도' }));
  await waitFor(() => expect(boundary.signedUrl).toHaveBeenCalledTimes(2));
});
