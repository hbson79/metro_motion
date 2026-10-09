// @vitest-environment jsdom
import React from 'react';
import { it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { VideoCard } from '../components/Shorts';
const item = {
  id: 'sample',
  title: '샘플',
  description: '샘플 영상',
  category: '자연',
  url: 'https://example.com/a.mp4',
};
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('plays only when active and pauses when made inactive', async () => {
  const { rerender } = render(
    <VideoCard
      item={item}
      active={false}
      muted
      paused={false}
      onTogglePause={() => {}}
      onToggleMute={() => {}}
      index={0}
    />,
  );
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  rerender(
    <VideoCard
      item={item}
      active
      muted
      paused={false}
      onTogglePause={() => {}}
      onToggleMute={() => {}}
      index={0}
    />,
  );
  await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce());
  rerender(
    <VideoCard
      item={item}
      active={false}
      muted
      paused={false}
      onTogglePause={() => {}}
      onToggleMute={() => {}}
      index={0}
    />,
  );
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
});
it('exposes labeled pause, mute and seeking controls', () => {
  const pause = vi.fn(),
    mute = vi.fn();
  render(
    <VideoCard
      item={item}
      active
      muted
      paused={false}
      onTogglePause={pause}
      onToggleMute={mute}
      index={0}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '일시 정지' }));
  fireEvent.click(screen.getByRole('button', { name: '소리 켜기' }));
  expect(pause).toHaveBeenCalledOnce();
  expect(mute).toHaveBeenCalledOnce();
  expect(screen.getByRole('slider', { name: '재생 위치' })).toBeTruthy();
});
it('displays playback failure with retry instead of pretending to play', () => {
  render(
    <VideoCard
      item={item}
      active
      muted
      paused={false}
      onTogglePause={() => {}}
      onToggleMute={() => {}}
      index={0}
    />,
  );
  fireEvent.error(document.querySelector('video')!);
  expect(screen.getByRole('button', { name: '영상 다시 시도' })).toBeTruthy();
});
