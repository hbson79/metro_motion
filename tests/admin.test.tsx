// @vitest-environment jsdom
import React from 'react';
import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import Admin, { Login, ContentEditor, CategoryManager } from '../components/Admin';
afterEach(cleanup);
it('editor uses managed categories instead of the hardcoded defaults', () => {
  const save = vi.fn();
  render(
    <ContentEditor
      kind="documents"
      categories={['여행']}
      onSave={save}
      onCancel={() => {}}
      busy={false}
    />,
  );
  expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['여행']);
  const file = new File(['pdf'], 'guide.pdf', { type: 'application/pdf' });
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '여행 가이드' } });
  fireEvent.change(screen.getByLabelText('파일 선택'), { target: { files: [file] } });
  fireEvent.submit(screen.getByRole('form', { name: '콘텐츠 편집' }));
  expect(save).toHaveBeenCalledWith(
    { title: '여행 가이드', description: '', category: '여행', published: false },
    file,
  );
});
it('category manager submits additions and renames with explicit original name', () => {
  const save = vi.fn();
  render(<CategoryManager categories={['도시']} busy={false} onSave={save} onDelete={() => {}} />);
  fireEvent.change(screen.getByLabelText('새 카테고리'), { target: { value: ' 여행 ' } });
  fireEvent.submit(screen.getByRole('form', { name: '카테고리 추가' }));
  expect(save).toHaveBeenCalledWith('여행');
  fireEvent.change(screen.getByLabelText('도시 이름'), { target: { value: '도시 풍경' } });
  fireEvent.submit(screen.getByRole('form', { name: '도시 카테고리 편집' }));
  expect(save).toHaveBeenCalledWith('도시 풍경', '도시');
});
it('admin without configuration cannot pretend to authenticate', () => {
  render(<Admin />);
  expect(screen.getByRole('heading', { name: '연결을 기다리는 스튜디오' })).toBeTruthy();
  expect(screen.queryByLabelText('비밀번호')).toBeNull();
});
it('login calls Supabase email password authentication and surfaces rejection', async () => {
  const signInWithPassword = vi
    .fn()
    .mockResolvedValue({ error: { message: 'Invalid login credentials' } });
  render(<Login client={{ auth: { signInWithPassword } } as never} />);
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'admin@example.test' } });
  fireEvent.change(screen.getByLabelText('비밀번호'), {
    target: { value: 'testing-only-password' },
  });
  fireEvent.click(screen.getByRole('button', { name: '스튜디오 로그인' }));
  await waitFor(() =>
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'admin@example.test',
      password: 'testing-only-password',
    }),
  );
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('Invalid login credentials'),
  );
});
it('editor blocks unsupported files before storage writes', async () => {
  const save = vi.fn();
  render(<ContentEditor kind="videos" onSave={save} onCancel={() => {}} busy={false} />);
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '새 영상' } });
  fireEvent.change(screen.getByLabelText('파일 선택'), {
    target: { files: [new File(['bad'], 'danger.exe', { type: 'application/x-msdownload' })] },
  });
  fireEvent.submit(screen.getByRole('form', { name: '콘텐츠 편집' }));
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toContain('지원하지 않는');
});
it('editor saves real file and explicit draft state', async () => {
  const save = vi.fn();
  render(<ContentEditor kind="documents" onSave={save} onCancel={() => {}} busy={false} />);
  const file = new File(['pdf'], 'guide.pdf', { type: 'application/pdf' });
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '가이드' } });
  fireEvent.change(screen.getByLabelText('파일 선택'), { target: { files: [file] } });
  fireEvent.submit(screen.getByRole('form', { name: '콘텐츠 편집' }));
  expect(save).toHaveBeenCalledWith(
    { title: '가이드', description: '', category: '도시', published: false },
    file,
  );
});
