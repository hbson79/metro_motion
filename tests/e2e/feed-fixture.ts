import { test as base, expect } from '@playwright/test';

// Test-only remote boundary: never query production DB/Auth/Storage.
export const test = base.extend({
  page: async ({ page }, use) => {
    let media: Promise<Buffer> | undefined;
    await page.route('https://categories.supabase.co/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/rest/v1/categories')
        return route.fulfill({
          json: ['도시', '자연', '라이프', '브랜드', '아트'].map((name) => ({ name })),
        });
      if (url.pathname === '/rest/v1/videos')
        return route.fulfill({
          json: [
            { id: 'fixture-1', title: '작은 순간의 움직임', category: '자연' },
            { id: 'fixture-2', title: '프레임 너머의 이야기', category: '아트' },
            { id: 'fixture-3', title: '움직임이 만드는 세계', category: '아트' },
          ].map((row) => ({
            ...row,
            description: '테스트 전용 영상입니다.',
            storage_path: `${row.id}.mp4`,
            published: true,
            created_at: '2026-01-01T00:00:00Z',
          })),
        });
      if (url.pathname.startsWith('/storage/v1/object/sign/metro-videos/'))
        return route.fulfill({ json: { signedURL: '/object/test-video.mp4' } });
      if (url.pathname === '/storage/v1/object/test-video.mp4') {
        media ??= (async () => {
          const response = await page.request.get(
            'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
          );
          if (!response.ok()) throw new Error(`Test media fetch failed: ${response.status()}`);
          return response.body();
        })();
        return route.fulfill({ body: await media, contentType: 'video/mp4' });
      }
      if (url.pathname === '/rest/v1/documents') return route.fulfill({ json: [] });
      throw new Error(`Unexpected feed fixture request: ${url.pathname}`);
    });
    await use(page);
    await page.unrouteAll({ behavior: 'wait' });
  },
});
export { expect };
