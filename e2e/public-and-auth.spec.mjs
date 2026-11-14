import { test, expect } from '@playwright/test';

function captureScriptFailures(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  return () => expect(errors, 'Unexpected browser JavaScript errors').toEqual([]);
}

async function noHorizontalOverflow(page) {
  // The standard mobile design should not force horizontal page scrolling.
  const metrics = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth
  }));
  expect(metrics.document, 'Page extends beyond the viewport').toBeLessThanOrEqual(metrics.viewport + 4);
}

test('French homepage renders the hero, imagery, public navigation and quote link', async ({page}) => {
  const assertNoScripts = captureScriptFailures(page);
  await page.goto('', {waitUntil: 'domcontentloaded'});
  await expect(page.locator('h1').first()).toContainText('Des sites');
  await expect(page.locator('.studio-brand')).toBeVisible();
  await expect(page.locator('.hero-actions a[href="devis.html"]')).toBeVisible();
  await expect(page.locator('.hero-screen img')).toBeVisible();
  await expect.poll(() => page.locator('.hero-screen img').evaluate(img => img.complete && img.naturalWidth > 0)).toBeTruthy();
  await expect(page.locator('main')).toBeVisible();
  await noHorizontalOverflow(page);
  assertNoScripts();
});

test('English website uses the correct navigation and quote page', async ({page}) => {
  const assertNoScripts = captureScriptFailures(page);
  await page.goto('en/', {waitUntil: 'domcontentloaded'});
  await expect(page.locator('h1').first()).toContainText('Websites');
  await expect(page.locator('.hero-actions a[href="quote.html"]')).toBeVisible();
  await expect(page.locator('.studio-languages a[lang="en"]')).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.hero-screen img')).toBeVisible();
  await noHorizontalOverflow(page);
  assertNoScripts();
});

test('The mobile menu opens, closes with Escape and preserves links', async ({page}, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'Mobile-only navigation');
  await page.goto('', {waitUntil: 'domcontentloaded'});
  const toggle = page.locator('#studio-menu');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#studio-navigation')).toHaveClass(/open/);
  await expect(page.locator('#studio-navigation a[href="services.html"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await noHorizontalOverflow(page);
});

test('Admin login and password-recovery screens work without granting access', async ({page}) => {
  const assertNoScripts = captureScriptFailures(page);
  await page.goto('admin/', {waitUntil: 'domcontentloaded'});
  await expect(page.locator('#auth')).toBeVisible();
  await expect(page.locator('#f-login')).toBeVisible();
  await expect(page.locator('#l-email')).toBeVisible();
  await expect(page.locator('#l-pass')).toBeVisible();
  await expect(page.locator('#app')).toBeHidden();
  await page.locator('#go-forgot').click();
  await expect(page.locator('#f-forgot')).toBeVisible();
  await expect(page.locator('#f-login')).toBeHidden();
  await page.locator('#f-forgot .go-login').click();
  await expect(page.locator('#f-login')).toBeVisible();
  await noHorizontalOverflow(page);
  assertNoScripts();
});

test('Client portal sign-in, sign-up and recovery remain reachable, without leaking private data', async ({page}) => {
  const assertNoScripts = captureScriptFailures(page);
  await page.goto('espace/', {waitUntil: 'domcontentloaded'});
  await expect(page.locator('#s-auth')).toBeVisible();
  await expect(page.locator('#f-login')).toBeVisible();
  await expect(page.locator('#app')).toBeHidden();
  await page.locator('button[data-go="f-signup"]').click();
  await expect(page.locator('#f-signup')).toBeVisible();
  await page.locator('button[data-go="f-login"]').click();
  await expect(page.locator('#f-login')).toBeVisible();
  await page.locator('button[data-go="f-forgot"]').click();
  await expect(page.locator('#f-forgot')).toBeVisible();
  await noHorizontalOverflow(page);
  assertNoScripts();
});

test('Private Rodney project page redirects an unauthenticated visitor to login', async ({page}) => {
  await page.goto('admin/suivi.html?q=c8a50cee-3856-4539-98a3-f5df201dbff0', {waitUntil: 'domcontentloaded'});
  await expect(page).toHaveURL(/\/admin\/?(?:\?.*)?$/);
  await expect(page.locator('#f-login')).toBeVisible();
  await expect(page.locator('#jr-tasks-slot')).toHaveCount(0);
});
