// @vitest-environment jsdom
import React from 'react';
import { it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Documents, { DocumentCard } from '../components/Documents';
afterEach(cleanup);
it('documents without environment explain setup instead of invented records', () => {
  render(<Documents />);
  expect(screen.getByRole('heading', { name: '연결을 기다리는 스튜디오' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: /문서 상세/ })).toBeNull();
});
it('document cards link to actual record ids and display format and size', () => {
  render(
    <DocumentCard
      row={{
        id: '11111111-1111-1111-1111-111111111111',
        title: '모션 가이드',
        description: '읽기 쉬운 안내',
        category: '브랜드',
        original_name: 'guide.pdf',
        mime_type: 'application/pdf',
        size_bytes: 1048576,
        storage_path: 'guide.pdf',
        published: true,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      }}
    />,
  );
  expect(screen.getByRole('link', { name: /모션 가이드/ }).getAttribute('href')).toBe(
    '/documents/11111111-1111-1111-1111-111111111111',
  );
  expect(screen.getByText('PDF')).toBeTruthy();
  expect(screen.getByText('1.0 MB')).toBeTruthy();
});
