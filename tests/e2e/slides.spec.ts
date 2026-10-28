import { test, expect } from '@playwright/test';
import type { Content } from '../../lib/domain';

// Remote-boundary fixture only: no operational Auth/DB/Storage requests.
test('HTML slides upload, isolated playback, replacement, publication and deletion', async ({
  page,
}, testInfo) => {
  let row: Content | null = null;
  let html = '';
  let failRead = false;
  const user = {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'fixture@example.test',
    aud: 'authenticated',
    role: 'authenticated',
  };
  await page.addInitScript(
    (user) =>
      localStorage.setItem(
        'sb-categories-auth-token',
        JSON.stringify({
          access_token: 'browser-fixture-only',
          refresh_token: 'browser-fixture-only',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: 'bearer',
          user,
        }),
      ),
    user,
  );
  await page.route('https://categories.supabase.co/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname === '/auth/v1/user') return route.fulfill({ json: user });
    if (url.pathname === '/rest/v1/admin_users')
      return route.fulfill({ json: { user_id: user.id } });
    if (url.pathname === '/rest/v1/categories') return route.fulfill({ json: [{ name: '도시' }] });
    if (url.pathname === '/rest/v1/videos') return route.fulfill({ json: [] });
    if (url.pathname === '/rest/v1/slides') {
      if (req.method() === 'POST')
        row = {
          ...req.postDataJSON(),
          id: user.id,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        };
      if (req.method() === 'PATCH') row = { ...row!, ...req.postDataJSON() };
      if (req.method() === 'DELETE') {
        row = null;
        return route.fulfill({ json: { id: user.id } });
      }
      const visible = row && (!url.searchParams.has('published') || row.published);
      return route.fulfill({
        json:
          req.method() !== 'GET' || url.searchParams.has('id')
            ? visible
              ? row
              : null
            : visible
              ? [row]
              : [],
      });
    }
    if (url.pathname.startsWith('/storage/v1/object/sign/metro-slides/')) {
      if (req.method() === 'POST')
        return route.fulfill({
          json: { signedURL: `/object/sign/metro-slides/deck.html?token=fixture` },
        });
      return failRead
        ? route.fulfill({ status: 500, body: 'failed' })
        : route.fulfill({ body: html, contentType: 'text/html' });
    }
    if (url.pathname.startsWith('/storage/v1/object/metro-slides'))
      return route.fulfill({ json: {} });
    throw new Error(`Unexpected fixture request: ${req.method()} ${url.pathname}`);
  });
  const deck = `<!doctype html><html lang="ko"><head><title>테스트 슬라이드</title><style>body{margin:0;padding:24px;background:#c4f564;color:#18200c;font:20px sans-serif}button{font:inherit;padding:12px}</style></head><body><h1 id="slide">첫 번째 슬라이드</h1><button onclick="document.querySelector('#slide').textContent='두 번째 슬라이드'">다음</button><script>try{parent.document.body.dataset.compromised='yes'}catch{};try{localStorage.getItem('sb-categories-auth-token');document.body.dataset.leaked='yes'}catch{};fetch('https://categories.supabase.co/probe').catch(()=>document.body.dataset.networkBlocked='yes');</script></body></html>`;
  try {
    await page.goto('/admin');
    await page.getByRole('button', { name: 'HTML 슬라이드', exact: true }).click();
    await page.getByRole('button', { name: '새 콘텐츠', exact: true }).click();
    await page.getByLabel('제목', { exact: true }).fill('도시 프레젠테이션');
    html = deck;
    await page
      .getByLabel('파일 선택')
      .setInputFiles({ name: 'deck.html', mimeType: 'text/html', buffer: Buffer.from(deck) });
    await page.getByRole('button', { name: '콘텐츠 저장', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: '도시 프레젠테이션', exact: true }),
    ).toBeVisible();
    expect(row!.published).toBe(false);
    // Admin can preview drafts through the same sandboxed viewer.
    await page.goto(`/slides/${user.id}`);
    const frame = page.frameLocator('iframe[title="도시 프레젠테이션"]');
    await expect(frame.getByRole('heading', { name: '첫 번째 슬라이드' })).toBeVisible();
    await expect(page.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts');
    await frame.getByRole('button', { name: '다음' }).click();
    await expect(frame.getByRole('heading', { name: '두 번째 슬라이드' })).toBeVisible();
    expect(await page.locator('body').getAttribute('data-compromised')).toBeNull();
    expect(await frame.locator('body').getAttribute('data-leaked')).toBeNull();
    await expect(frame.locator('body')).toHaveAttribute('data-network-blocked', 'yes');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (testInfo.project.name === 'mobile') {
      const box = await page.locator('iframe').boundingBox();
      const nav = await page.getByRole('navigation', { name: '모바일 메뉴' }).boundingBox();
      expect(box!.y + box!.height).toBeLessThanOrEqual(nav!.y);
      for (const size of [
        { width: 360, height: 667 },
        { width: 390, height: 844 },
      ]) {
        await page.setViewportSize(size);
        const frameBox = await page.locator('iframe').boundingBox();
        const navBox = await page.getByRole('navigation', { name: '모바일 메뉴' }).boundingBox();
        expect(frameBox!.y + frameBox!.height).toBeLessThanOrEqual(navBox!.y);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      }
    } else {
      await page.getByRole('button', { name: '전체 화면', exact: true }).click();
      await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
      await page.evaluate(() => document.exitFullscreen());
    }
    await page.screenshot({ path: testInfo.outputPath('slides-viewer.png'), fullPage: true });
    failRead = true;
    await page.reload();
    await expect(page.locator('main').getByRole('alert')).toContainText('슬라이드');
    failRead = false;
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    await expect(frame.getByRole('heading', { name: '첫 번째 슬라이드' })).toBeVisible();
    await page.goto('/admin');
    await page.getByRole('button', { name: 'HTML 슬라이드', exact: true }).click();
    await page.getByRole('button', { name: '도시 프레젠테이션 공개하기', exact: true }).click();
    await expect.poll(() => row?.published).toBe(true);
    await page.goto('/slides');
    await page.getByLabel('슬라이드 검색').fill('없는 제목');
    await expect(page.getByRole('heading', { name: '검색 결과가 없습니다.' })).toBeVisible();
    await page.getByLabel('슬라이드 검색').fill('도시');
    await page.getByRole('link', { name: /도시 프레젠테이션/ }).click();
    await expect(frame.getByRole('heading', { name: '첫 번째 슬라이드' })).toBeVisible();
    await page.goto('/admin');
    await page.getByRole('button', { name: 'HTML 슬라이드', exact: true }).click();
    await page.getByRole('button', { name: '도시 프레젠테이션 수정', exact: true }).click();
    await page.getByLabel('제목', { exact: true }).fill('수정된 슬라이드');
    html = deck.replaceAll('첫 번째 슬라이드', '교체한 슬라이드');
    await page
      .getByLabel('파일 선택')
      .setInputFiles({ name: 'replacement.htm', mimeType: 'text/html', buffer: Buffer.from(html) });
    await page.getByRole('button', { name: '변경 사항 저장', exact: true }).click();
    await expect(page.getByRole('heading', { name: '수정된 슬라이드', exact: true })).toBeVisible();
    expect(row!.original_name).toBe('replacement.htm');
    await page.getByRole('button', { name: '수정된 슬라이드 비공개로 전환', exact: true }).click();
    await expect.poll(() => row?.published).toBe(false);
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '수정된 슬라이드 삭제', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: '아직 등록된 콘텐츠가 없습니다.' }),
    ).toBeVisible();
    expect(row).toBeNull();
  } finally {
    await page.unrouteAll({ behavior: 'wait' });
  }
});
