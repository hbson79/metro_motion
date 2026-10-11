// @vitest-environment jsdom
import React from 'react';
import { it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Home from '../app/page';
afterEach(cleanup);
it('shows configuration guidance without a demo entry or fabricated content', () => {
  render(<Home />);
  expect(screen.getByRole('heading', { name: '연결을 기다리는 스튜디오' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: /데모 플레이어/ })).toBeNull();
  expect(screen.queryByText('저장 완료')).toBeNull();
});
