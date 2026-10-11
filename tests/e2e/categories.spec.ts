import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Explicit remote-boundary fixture. No production Auth or DB requests.
test('category management adds, renames, rejects in-use deletion and updates public filters', async ({
  page,
}) => {
  let names = ['도시', '자연'];
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
    if (url.pathname === '/rest/v1/categories') {
      const original = url.searchParams.get('name')?.replace(/^eq\./, '');
      if (request.method() === 'GET')
        return route.fulfill({ json: names.map((name) => ({ name })) });
      if (request.method() === 'DELETE' && original === '도시')
        return route.fulfill({
          status: 409,
          json: { code: '23503', message: 'fixture foreign key restriction' },
        });
      if (request.method() === 'DELETE') {
        names = names.filter((name) => name !== original);
        return route.fulfill({ json: { name: original } });
      }
      const name = request.postDataJSON().name as string;
      if (request.method() === 'POST') names.push(name);
      if (request.method() === 'PATCH')
        names = names.map((value) => (value === original ? name : value));
      return route.fulfill({ json: { name } });
    }
    if (url.pathname === '/rest/v1/videos' || url.pathname === '/rest/v1/documents')
      return route.fulfill({ json: [] });
    throw new Error(`Unexpected fixture request: ${request.method()} ${url.pathname}`);
  });
  await page.goto('/admin');
  await page.getByRole('button', { name: '카테고리 관리' }).click();
  await page.getByLabel('새 카테고리').fill('여행');
  await page.getByRole('button', { name: '카테고리 추가', exact: true }).click();
  await expect(page.getByLabel('여행 이름')).toBeVisible();
  await page.getByLabel('여행 이름').fill('여행 기록');
  await page
    .getByRole('form', { name: '여행 카테고리 편집' })
    .getByRole('button', { name: '이름 변경' })
    .click();
  await expect(page.getByLabel('여행 기록 이름')).toBeVisible();
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '도시 카테고리 삭제', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: '사용 중' })).toBeVisible();
  await page.getByRole('button', { name: '자연 카테고리 삭제', exact: true }).click();
  await expect(page.getByLabel('자연 이름')).toHaveCount(0);
  await expect(
    page.getByRole('status').filter({ hasText: '카테고리를 삭제했습니다.' }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter((v) => ['serious', 'critical'].includes(v.impact || '')),
  ).toEqual([]);
  await page.getByRole('button', { name: '새 콘텐츠' }).click();
  await expect(page.getByLabel('카테고리', { exact: true }).locator('option')).toHaveText([
    '도시',
    '여행 기록',
  ]);
  names.push('긴'.repeat(40));
  for (const path of ['/', '/documents']) {
    await page.goto(path);
    await expect(page.getByRole('button', { name: '여행 기록', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '자연', exact: true })).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});
