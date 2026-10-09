import { test, expect } from '@playwright/test';
test('maximum-length metadata stays inside video rather than hiding the picture', async ({
  page,
}) => {
  await page.goto('/demo');
  await page.locator('.is-active .video-caption p').evaluate((el) => {
    el.textContent = '가나다라 '.repeat(800);
  });
  await page.locator('.is-active .video-caption h2').evaluate((el) => {
    el.textContent = '긴영상제목'.repeat(24);
  });
  const bounds = await page.evaluate(() => ({
    caption: document.querySelector('.is-active .video-caption')!.getBoundingClientRect().top,
    video: document.querySelector('.video-scroller')!.getBoundingClientRect().top,
  }));
  expect(bounds.caption).toBeGreaterThan(bounds.video + 40);
});
