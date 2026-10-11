import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Content } from '../../lib/domain';

// Explicit remote-boundary fixture; never contacts operational Auth/DB/Storage.
test('image uploads save all photo formats and preview without downloading', async ({
  page,
}, testInfo) => {
  const rows: Content[] = [];
  const media = new Map<string, { buffer: Buffer; mime: string }>();
  const signs: Record<string, unknown>[] = [];
  let uploads = 0;
  const user = {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'fixture@example.test',
    aud: 'authenticated',
    role: 'authenticated',
  };
  await page.addInitScript((user) => {
    localStorage.setItem(
      'sb-categories-auth-token',
      JSON.stringify({
        access_token: 'browser-fixture-only',
        refresh_token: 'browser-fixture-only',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        token_type: 'bearer',
        user,
      }),
    );
  }, user);
  await page.route('https://categories.supabase.co/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/auth/v1/user') return route.fulfill({ json: user });
    if (url.pathname === '/rest/v1/admin_users')
      return route.fulfill({ json: { user_id: user.id } });
    if (url.pathname === '/rest/v1/categories') return route.fulfill({ json: [{ name: '도시' }] });
    if (url.pathname === '/rest/v1/videos') return route.fulfill({ json: [] });
    if (url.pathname === '/rest/v1/documents') {
      if (request.method() === 'POST') {
        const row = {
          ...request.postDataJSON(),
          id: `00000000-0000-0000-0000-${String(rows.length + 1).padStart(12, '0')}`,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        } as Content;
        const ext = row.original_name.split('.').pop()!.toLowerCase();
        media.set(row.storage_path, media.get(ext)!);
        rows.push(row);
        return route.fulfill({ json: row });
      }
      const id = url.searchParams.get('id')?.replace(/^eq\./, '');
      return route.fulfill({ json: id ? rows.find((row) => row.id === id) : rows });
    }
    if (url.pathname.startsWith('/storage/v1/object/sign/metro-documents/')) {
      signs.push(request.postDataJSON());
      return route.fulfill({
        json: {
          signedURL: `/object/sign/metro-documents/${url.pathname.split('/').pop()}?token=fixture`,
        },
      });
    }
    if (
      url.pathname.startsWith('/storage/v1/object/metro-documents/') &&
      request.method() === 'POST'
    ) {
      uploads++;
      return route.fulfill({ json: { Key: url.pathname.split('/').pop() } });
    }
    if (
      url.pathname.startsWith('/storage/v1/object/sign/metro-documents/') &&
      request.method() === 'GET'
    ) {
      throw new Error('GET must be served as image');
    }
    throw new Error(`Unexpected fixture request: ${request.method()} ${url.pathname}`);
  });
  // Image GET routes take precedence over the JSON signing route above.
  await page.route(
    'https://categories.supabase.co/storage/v1/object/sign/metro-documents/*?token=fixture',
    async (route) => {
      const image = media.get(new URL(route.request().url()).pathname.split('/').pop()!)!;
      await route.fulfill({ body: image.buffer, contentType: image.mime });
    },
  );
  try {
    await page.goto('/admin');
    await page.getByRole('button', { name: '자료 문서', exact: true }).click();
    for (const [ext, mime] of [
      ['jpg', 'image/jpeg'],
      ['jpeg', 'image/jpeg'],
      ['png', 'image/png'],
      ['webp', 'image/webp'],
    ]) {
      const encoded = await page.evaluate((mime) => {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 500;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#c4f564';
        ctx.fillRect(0, 0, 800, 500);
        ctx.fillStyle = '#263211';
        ctx.fillRect(100, 100, 600, 300);
        return canvas.toDataURL(mime);
      }, mime);
      expect(encoded.startsWith(`data:${mime};`)).toBe(true);
      const buffer = Buffer.from(encoded.split(',')[1], 'base64');
      media.set(ext, { buffer, mime });
      await page.getByRole('button', { name: '새 콘텐츠', exact: true }).click();
      await page.getByLabel('제목', { exact: true }).fill(`사진 ${ext}`);
      await page
        .getByLabel('파일 선택')
        .setInputFiles({ name: `photo.${ext}`, mimeType: mime, buffer });
      await page.getByLabel('저장과 동시에 공개', { exact: false }).check();
      await page.getByRole('button', { name: '콘텐츠 저장', exact: true }).click();
      await expect(page.getByRole('heading', { name: `사진 ${ext}`, exact: true })).toBeVisible();
      expect(rows.at(-1)?.mime_type).toBe(mime);
    }
    expect(uploads).toBe(4);
    // Capture the actual popup URL without navigating to an external window.
    await page.evaluate(() => {
      const tab = { opener: null, location: { href: '' } };
      (window as unknown as { previewTab: typeof tab }).previewTab = tab;
      window.open = () => tab as unknown as Window;
    });
    await page.getByRole('button', { name: '사진 jpg 파일 확인', exact: true }).click();
    await expect.poll(() => signs.length).toBe(1);
    expect(signs[0]).not.toHaveProperty('download');
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { previewTab: { location: { href: string } } }).previewTab
              .location.href,
        ),
      )
      .toContain('token=fixture');
    const previewUrl = await page.evaluate(
      () =>
        (window as unknown as { previewTab: { location: { href: string } } }).previewTab.location
          .href,
    );
    expect(new URL(previewUrl).searchParams.has('download')).toBe(false);
    let downloads = 0;
    page.on('download', () => downloads++);
    for (const row of rows) {
      await page.goto(`/documents/${row.id}`);
      const image = page.getByRole('img', { name: row.title, exact: true });
      await expect(image).toBeVisible();
      await expect
        .poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth))
        .toBe(800);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const box = await image.boundingBox();
      expect(box!.width).toBeGreaterThan(0);
      expect(box!.height).toBeLessThanOrEqual(page.viewportSize()!.height * 0.7 + 1);
    }
    expect(downloads).toBe(0);
    expect(signs.every((sign) => !('download' in sign))).toBe(true);
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(
      accessibility.violations.filter((v) => ['serious', 'critical'].includes(v.impact || '')),
    ).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('image-preview.png'), fullPage: true });
  } finally {
    await page.unrouteAll({ behavior: 'wait' });
  }
});
