// @vitest-environment jsdom
import React from 'react';
import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ContentEditor } from '../components/Admin';
import { validateUpload } from '../lib/domain';
afterEach(cleanup);
it('slide editor accepts HTML only and saves an explicit draft', () => {
  const save = vi.fn();
  render(<ContentEditor kind={'slides' as never} onSave={save} onCancel={() => {}} busy={false} />);
  const input = screen.getByLabelText('파일 선택');
  expect(input.getAttribute('accept')).toBe('.html,.htm');
  const file = new File(['<!doctype html><h1>슬라이드</h1>'], 'deck.HTML', { type: 'text/html' });
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '도시 슬라이드' } });
  fireEvent.change(input, { target: { files: [file] } });
  fireEvent.submit(screen.getByRole('form', { name: '콘텐츠 편집' }));
  expect(save).toHaveBeenCalledWith(
    { title: '도시 슬라이드', description: '', category: '도시', published: false },
    file,
  );
});
it('HTML is supported only in slides, with matching MIME, extension and size', () => {
  const file = { name: 'deck.htm', type: 'text/html', size: 100 };
  expect(validateUpload(file, 'slides' as never)).toBeNull();
  expect(validateUpload(file, 'documents')).not.toBeNull();
  expect(validateUpload(file, 'videos')).not.toBeNull();
  expect(validateUpload({ ...file, type: 'text/plain' }, 'slides' as never)).not.toBeNull();
  expect(validateUpload({ ...file, name: 'deck.svg' }, 'slides' as never)).not.toBeNull();
  expect(validateUpload({ ...file, size: 21 * 1024 * 1024 }, 'slides' as never)).not.toBeNull();
});
