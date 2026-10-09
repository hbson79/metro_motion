import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('feed removes decorative topbar and reserves only mobile navigation height', async ({
  page,
  isMobile,
}) => {
  await page.goto('/demo');
  await expect(page.locator('.topbar')).toHaveCount(0);
  const bounds = await page.evaluate(() => {
    const feed = document.querySelector('.feed-page')!.getBoundingClientRect();
    const nav = document.querySelector('.mobile-nav')!.getBoundingClientRect();
    const video = document.querySelector('.video-scroller')!.getBoundingClientRect();
    return {
      top: feed.top,
      bottom: feed.bottom,
      navTop: nav.top,
      height: innerHeight,
      videoBottom: video.bottom,
    };
  });
  expect(bounds.top).toBe(0);
  expect(bounds.bottom).toBe(isMobile ? bounds.navTop : bounds.height);
  expect(bounds.videoBottom).toBeLessThanOrEqual(bounds.bottom);
  await page.goto('/');
  await expect(page.locator('.topbar')).toHaveCount(0);
  await page.goto('/documents');
  await expect(page.locator('.topbar')).toBeVisible();
});
test('compact feed keeps categories and search on one row and gives space to video', async ({
  page,
  isMobile,
}) => {
  const sizes = isMobile
    ? [
        { width: 390, height: 844 },
        { width: 360, height: 667 },
      ]
    : [
        { width: 1440, height: 1000 },
        { width: 1024, height: 768 },
      ];
  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.goto('/demo');
    await expect(page.getByRole('heading', { level: 1 })).not.toBeVisible();
    const tabs = await page.locator('[aria-label="영상 카테고리"]').boundingBox();
    const search = await page.getByRole('textbox', { name: '영상 검색' }).boundingBox();
    const video = await page.locator('.video-scroller').boundingBox();
    expect(tabs).not.toBeNull();
    expect(search).not.toBeNull();
    expect(video).not.toBeNull();
    expect(Math.abs(tabs!.y + tabs!.height / 2 - search!.y - search!.height / 2)).toBeLessThan(2);
    expect(tabs!.x + tabs!.width).toBeLessThanOrEqual(search!.x);
    expect(video!.height).toBeGreaterThan(size.height * (isMobile ? 0.6 : 0.65));
    const limit = isMobile
      ? (await page.getByRole('navigation', { name: '모바일 메뉴' }).boundingBox())!.y
      : size.height;
    expect(video!.y + video!.height).toBeLessThanOrEqual(limit);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: '아트', exact: true }).click();
    await expect(page.locator('.video-card')).toHaveCount(2);
    await page.getByRole('textbox', { name: '영상 검색' }).fill('프레임');
    await expect(page.locator('.video-card')).toHaveCount(1);
  }
});
test('honest setup and accessible responsive navigation', async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '연결을 기다리는 스튜디오' })).toBeVisible();
  await expect(page.getByRole('link', { name: '데모 플레이어 둘러보기' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  if (isMobile) await expect(page.getByRole('navigation', { name: '모바일 메뉴' })).toBeVisible();
  else await expect(page.locator('.sidebar')).toHaveCSS('width', '244px');
  await page.screenshot({
    path: `test-results/setup-${isMobile ? 'mobile' : 'desktop'}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test('real demo plays only active video, supports pause mute keyboard wheel and filter', async ({
  page,
  isMobile,
}) => {
  await page.goto('/demo');
  await expect(page.getByText('공개 샘플 데모 ·', { exact: false })).toBeVisible();
  const first = page.locator('video').first();
  await expect
    .poll(() => first.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 30000 })
    .toBeGreaterThanOrEqual(2);
  await expect
    .poll(() =>
      page
        .locator('video')
        .evaluateAll((videos: HTMLVideoElement[]) => videos.filter((v) => !v.paused).length),
    )
    .toBe(1);
  expect(await page.locator('.video-scroller').evaluate((el) => el.clientHeight)).toBeGreaterThan(
    300,
  );
  await page.getByRole('button', { name: '일시 정지', exact: true }).click();
  await expect.poll(() => first.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  await page.getByRole('button', { name: '재생', exact: true }).click();
  await page.getByRole('button', { name: '소리 켜기' }).click();
  await expect.poll(() => first.evaluate((v: HTMLVideoElement) => v.muted)).toBe(false);
  await page.getByRole('button', { name: '음소거', exact: true }).click();
  await page.locator('.video-scroller').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.is-active')).toHaveAttribute('aria-label', '2. 프레임 너머의 이야기');
  await expect.poll(() => first.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  await expect
    .poll(() =>
      page
        .locator('video')
        .evaluateAll((videos: HTMLVideoElement[]) => videos.filter((v) => !v.paused).length),
    )
    .toBeLessThanOrEqual(1);
  await page.locator('.video-scroller').hover();
  await page.mouse.wheel(0, 600);
  await expect(page.locator('.is-active')).toHaveAttribute('aria-label', '3. 움직임이 만드는 세계');
  await page.getByRole('button', { name: '자연', exact: true }).click();
  await expect(page.locator('.video-card')).toHaveCount(1);
  await page.getByRole('textbox', { name: '영상 검색' }).fill('없는영상');
  await expect(page.getByRole('heading', { name: '일치하는 순간이 없습니다.' })).toBeVisible();
  await page.getByRole('button', { name: '필터 초기화' }).click();
  await expect(page.locator('.video-card')).toHaveCount(3);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await expect
    .poll(() =>
      page
        .locator('video')
        .first()
        .evaluate((v: HTMLVideoElement) => v.readyState),
    )
    .toBeGreaterThanOrEqual(2);
  await expect
    .poll(() =>
      page
        .locator('video')
        .first()
        .evaluate((v: HTMLVideoElement) => v.currentTime),
    )
    .toBeGreaterThan(0.05);
  await page.screenshot({
    path: `test-results/demo-${isMobile ? 'mobile' : 'desktop'}.png`,
    fullPage: true,
  });
  if (isMobile) {
    const box = await page.locator('.video-scroller').boundingBox();
    if (!box) throw new Error('Missing swipe surface');
    const cdp = await page.context().newCDPSession(page);
    const x = box.x + box.width / 2;
    const y = box.y + box.height * 0.8;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let step = 1; step <= 12; step++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: y - (box.height * 0.65 * step) / 12 }],
      });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('.is-active')).not.toHaveAttribute(
      'aria-label',
      '1. 작은 순간의 움직임',
    );
    await expect.poll(() => first.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
    await cdp.detach();
  }
});
test('player fits viewport without navigation covering controls', async ({ page, isMobile }) => {
  await page.goto('/demo');
  const bounds = await page.evaluate(() => ({
    height: innerHeight,
    controlBottom: document.querySelector('.is-active .video-controls')!.getBoundingClientRect()
      .bottom,
    navTop: document.querySelector('.mobile-nav')!.getBoundingClientRect().top,
  }));
  expect(bounds.controlBottom).toBeLessThanOrEqual(isMobile ? bounds.navTop : bounds.height);
});
test('setup and demo have no serious automated accessibility violations', async ({ page }) => {
  for (const route of ['/', '/demo']) {
    await page.goto(route);
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(result.violations).toEqual([]);
  }
});
test('library detail and admin never fabricate auth without environment', async ({ page }) => {
  for (const url of ['/documents', '/documents/11111111-1111-1111-1111-111111111111', '/admin']) {
    await page.goto(url);
    await expect(page.getByRole('heading', { name: '연결을 기다리는 스튜디오' })).toBeVisible();
    await expect(page.getByLabel('비밀번호', { exact: true })).toHaveCount(0);
  }
});
