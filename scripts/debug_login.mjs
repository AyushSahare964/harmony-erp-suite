import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    console.log(`[CONSOLE ${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.error('[PAGE ERROR]', err);
  });

  console.log('Navigating to /login...');
  await page.goto('http://localhost:8080/login');
  await page.waitForTimeout(2000);

  console.log('Filling form...');
  await page.fill('input[type="email"]', 'ayush.sahare@vit.edu');
  await page.fill('input[type="password"]', 'ayush@123');

  console.log('Clicking button[type="submit"]...');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(4000);

  const toasts = await page.locator('[data-sonner-toast]').allInnerTexts().catch(() => []);
  console.log('Toasts visible:', toasts);

  const url = page.url();
  console.log('Current URL:', url);

  await browser.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
