import { test, expect } from './feed-fixture';
test('compact caption leaves more of the video visible', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === 'mobile';
  for (const viewport of mobile
    ? [
        { width: 390, height: 844 },
        { width: 360, height: 667 },
      ]
    : [
        { width: 1440, height: 1000 },
        { width: 1024, height: 768 },
      ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const caption = page.locator('.is-active .video-caption');
    await caption.locator('h2').evaluate((el) => {
      el.textContent = '긴영상제목'.repeat(24);
    });
    await caption.locator('p').evaluate((el) => {
      el.textContent = '영상 설명 '.repeat(800);
    });
    const layout = await caption.evaluate((el) => {
      const title = el.querySelector('h2')!;
      const description = el.querySelector('p')!;
      const style = getComputedStyle(title);
      const bounds = el.getBoundingClientRect();
      const controls = el.parentElement!.querySelector('.video-controls')!.getBoundingClientRect();
      return {
        fontSize: parseFloat(style.fontSize),
        marginTop: parseFloat(style.marginTop),
        marginBottom: parseFloat(style.marginBottom),
        height: bounds.height,
        bottom: bounds.bottom,
        controlsTop: controls.top,
        descriptionLines: getComputedStyle(description).webkitLineClamp,
      };
    });
    expect(layout.fontSize).toBeLessThanOrEqual(mobile ? 16 : 18);
    expect(layout.marginTop).toBeLessThanOrEqual(4);
    expect(layout.marginBottom).toBeLessThanOrEqual(3);
    expect(layout.descriptionLines).toBe('2');
    expect(layout.height).toBeLessThanOrEqual(140);
    expect(layout.bottom).toBeLessThanOrEqual(layout.controlsTop - 4);
    await page.screenshot({ path: testInfo.outputPath(`compact-caption-${viewport.width}.png`) });
  }
});
test('maximum-length metadata stays inside video rather than hiding the picture', async ({
  page,
}) => {
  await page.goto('/');
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
